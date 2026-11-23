import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { CustomerProfileDTO } from '@minieshop/contracts';
import {
  emailNotVerifiedError,
  invalidCredentialsError,
  unauthenticatedError,
} from '../../common/errors.js';
import { DatabaseService } from '../../database/database.service.js';
import { customers } from '../../database/schema/index.js';
import { OutboxService } from '../platform/index.js';
import { EmailTokenService } from './email-token.service.js';
import { PasswordService } from './password.service.js';
import {
  enforceRateLimit,
  RATE_LIMIT_RULES,
  RATE_LIMITER_TOKEN,
  type RateLimiter,
} from './rate-limiter.js';
import { SessionService } from './session.service.js';

export const GENERIC_REGISTER_MESSAGE =
  'If this email can be registered, we have sent instructions to your inbox.';

export function normalizeEmail(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase();
}

export function toCustomerProfileDto(row: {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}): CustomerProfileDTO {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    phone: row.phone,
    emailVerified: row.emailVerifiedAt !== null,
    emailVerifiedAt: row.emailVerifiedAt ? row.emailVerifiedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class CustomerAuthService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
    @Inject(SessionService)
    private readonly sessionService: SessionService,
    @Inject(EmailTokenService)
    private readonly emailTokenService: EmailTokenService,
    @Inject(OutboxService)
    private readonly outboxService: OutboxService,
    @Inject(RATE_LIMITER_TOKEN)
    private readonly rateLimiter: RateLimiter,
  ) {}

  async register(input: {
    email: string;
    password: string;
    fullName: string;
    ipAddress: string;
  }): Promise<{ accepted: true; message: string }> {
    await enforceRateLimit(this.rateLimiter, [
      { key: `register:ip:${input.ipAddress}`, rule: RATE_LIMIT_RULES.REGISTER_IP },
    ]);

    const email = normalizeEmail(input.email);
    const normalizedPassword = this.passwordService.validatePolicy(input.password, email);

    const [existing] = await this.databaseService.db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1);

    if (existing) {
      // Anti-enumeration: perform dummy hash for timing parity and send "already registered" notice
      await this.passwordService.verifyDummy(normalizedPassword);
      await this.databaseService.db.transaction(async (tx) => {
        await this.outboxService.enqueue(tx, {
          eventType: 'identity.email_requested',
          aggregateType: 'customer',
          aggregateId: existing.id,
          payload: {
            kind: 'already_registered',
            customerId: existing.id,
          },
        });
      });

      return { accepted: true, message: GENERIC_REGISTER_MESSAGE };
    }

    const passwordHash = await this.passwordService.hash(normalizedPassword);

    await this.databaseService.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(customers)
        .values({
          email,
          passwordHash,
          fullName: input.fullName.trim(),
          emailVerifiedAt: null,
          isActive: true,
        })
        .onConflictDoNothing({ target: customers.email })
        .returning({ id: customers.id });

      if (!created) {
        // Race condition: email was inserted concurrently; treat as existing
        const [raced] = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.email, email))
          .limit(1);
        if (raced) {
          await this.outboxService.enqueue(tx, {
            eventType: 'identity.email_requested',
            aggregateType: 'customer',
            aggregateId: raced.id,
            payload: {
              kind: 'already_registered',
              customerId: raced.id,
            },
          });
        }
        return;
      }

      const { emailTokenId } = await this.emailTokenService.issueToken({
        customerId: created.id,
        purpose: 'verify_email',
        tx,
      });

      await this.outboxService.enqueue(tx, {
        eventType: 'identity.email_requested',
        aggregateType: 'customer',
        aggregateId: created.id,
        payload: {
          kind: 'verify_email',
          customerId: created.id,
          emailTokenId,
        },
      });
    });

    return { accepted: true, message: GENERIC_REGISTER_MESSAGE };
  }

  async login(input: {
    email: string;
    password: string;
    ipAddress: string;
    userAgent: string | null;
    existingRawToken?: string;
  }): Promise<{
    customer: CustomerProfileDTO;
    rawToken: string;
    sessionId: string;
  }> {
    const email = normalizeEmail(input.email);

    await enforceRateLimit(this.rateLimiter, [
      { key: `login:ip:${input.ipAddress}`, rule: RATE_LIMIT_RULES.LOGIN_IP },
      { key: `login:account:${email}`, rule: RATE_LIMIT_RULES.LOGIN_ACCOUNT },
    ]);

    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1);

    if (!customer || !customer.isActive) {
      await this.passwordService.verifyDummy(input.password);
      throw invalidCredentialsError();
    }

    const passwordValid = await this.passwordService.verify(customer.passwordHash, input.password);
    if (!passwordValid) {
      throw invalidCredentialsError();
    }

    if (customer.emailVerifiedAt === null) {
      throw emailNotVerifiedError();
    }

    // Transparent Argon2id rehash when env parameters were upgraded
    if (this.passwordService.needsRehash(customer.passwordHash)) {
      const upgradedHash = await this.passwordService.hash(input.password);
      await this.databaseService.db
        .update(customers)
        .set({ passwordHash: upgradedHash, updatedAt: new Date() })
        .where(eq(customers.id, customer.id));
    }

    // Regenerate session on login (anti session-fixation)
    const createdSession = await this.databaseService.db.transaction(async (tx) => {
      if (input.existingRawToken) {
        await this.sessionService.revokeSessionByRawToken(input.existingRawToken, 'customer', tx);
      }
      return this.sessionService.createSession({
        subjectType: 'customer',
        subjectId: customer.id,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        tx,
      });
    });

    await this.rateLimiter.reset(`login:account:${email}`);

    return {
      customer: toCustomerProfileDto(customer),
      rawToken: createdSession.rawToken,
      sessionId: createdSession.sessionId,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionService.revokeSession(sessionId);
  }

  async logoutAll(customerId: string): Promise<void> {
    await this.sessionService.revokeAllCustomerSessions(customerId);
  }

  async getMe(customerId: string): Promise<CustomerProfileDTO> {
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (!customer || !customer.isActive) {
      throw unauthenticatedError();
    }

    return toCustomerProfileDto(customer);
  }
}
