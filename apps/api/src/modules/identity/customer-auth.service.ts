import { Inject, Injectable, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { CustomerProfileDTO } from '@minieshop/contracts';
import {
  emailNotVerifiedError,
  invalidCredentialsError,
  unauthenticatedError,
} from '../../common/errors.js';
import { DatabaseService } from '../../database/database.service.js';
import { customers } from '../../database/schema/index.js';
import { CatalogService } from '../catalog/index.js';
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
export const GENERIC_VERIFICATION_MESSAGE =
  'If an unverified account exists for this email, we have sent a new verification link.';
export const GENERIC_PASSWORD_RESET_MESSAGE =
  'If an account exists for this email, we have sent password reset instructions.';

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
    @Optional()
    @Inject(CatalogService)
    private readonly catalogService?: CatalogService,
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
    anonSessionId?: string;
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

    // Regenerate session on login (anti session-fixation) and merge anonymous favorites atomically
    const createdSession = await this.databaseService.db.transaction(async (tx) => {
      if (input.existingRawToken) {
        await this.sessionService.revokeSessionByRawToken(input.existingRawToken, 'customer', tx);
      }
      if (input.anonSessionId && this.catalogService) {
        await this.catalogService.mergeAnonymousFavorites(tx, input.anonSessionId, customer.id);
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

  async verifyEmail(rawToken: string): Promise<{ verified: true }> {
    await this.databaseService.db.transaction(async (tx) => {
      const { customerId } = await this.emailTokenService.verifyAndConsumeToken(
        rawToken,
        'verify_email',
        tx,
      );

      await tx
        .update(customers)
        .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(customers.id, customerId));
    });

    return { verified: true };
  }

  async resendVerification(input: {
    email: string;
    ipAddress: string;
  }): Promise<{ accepted: true; message: string }> {
    const email = normalizeEmail(input.email);

    await enforceRateLimit(this.rateLimiter, [
      { key: `resend-verify:ip:${input.ipAddress}`, rule: RATE_LIMIT_RULES.RESEND_VERIFICATION_IP },
      {
        key: `resend-verify:account:${email}`,
        rule: RATE_LIMIT_RULES.RESEND_VERIFICATION_ACCOUNT,
      },
    ]);

    const [customer] = await this.databaseService.db
      .select({ id: customers.id, emailVerifiedAt: customers.emailVerifiedAt, isActive: customers.isActive })
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1);

    if (customer && customer.isActive && customer.emailVerifiedAt === null) {
      await this.databaseService.db.transaction(async (tx) => {
        const { emailTokenId } = await this.emailTokenService.issueToken({
          customerId: customer.id,
          purpose: 'verify_email',
          tx,
        });

        await this.outboxService.enqueue(tx, {
          eventType: 'identity.email_requested',
          aggregateType: 'customer',
          aggregateId: customer.id,
          payload: {
            kind: 'verify_email',
            customerId: customer.id,
            emailTokenId,
          },
        });
      });
    }

    return { accepted: true, message: GENERIC_VERIFICATION_MESSAGE };
  }

  async forgotPassword(input: {
    email: string;
    ipAddress: string;
  }): Promise<{ accepted: true; message: string }> {
    const email = normalizeEmail(input.email);

    await enforceRateLimit(this.rateLimiter, [
      { key: `forgot-pwd:ip:${input.ipAddress}`, rule: RATE_LIMIT_RULES.FORGOT_PASSWORD_IP },
      {
        key: `forgot-pwd:account:${email}`,
        rule: RATE_LIMIT_RULES.FORGOT_PASSWORD_ACCOUNT,
      },
    ]);

    const [customer] = await this.databaseService.db
      .select({ id: customers.id, isActive: customers.isActive })
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1);

    if (customer && customer.isActive) {
      await this.databaseService.db.transaction(async (tx) => {
        const { emailTokenId } = await this.emailTokenService.issueToken({
          customerId: customer.id,
          purpose: 'reset_password',
          tx,
        });

        await this.outboxService.enqueue(tx, {
          eventType: 'identity.email_requested',
          aggregateType: 'customer',
          aggregateId: customer.id,
          payload: {
            kind: 'reset_password',
            customerId: customer.id,
            emailTokenId,
          },
        });
      });
    }

    return { accepted: true, message: GENERIC_PASSWORD_RESET_MESSAGE };
  }

  async resetPassword(input: { token: string; newPassword: string }): Promise<{ reset: true }> {
    await this.databaseService.db.transaction(async (tx) => {
      const { customerId } = await this.emailTokenService.verifyAndConsumeToken(
        input.token,
        'reset_password',
        tx,
      );

      const [customer] = await tx
        .select({ id: customers.id, email: customers.email, isActive: customers.isActive })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (!customer || !customer.isActive) {
        throw unauthenticatedError();
      }

      const normalizedPassword = this.passwordService.validatePolicy(
        input.newPassword,
        customer.email,
      );
      const passwordHash = await this.passwordService.hash(normalizedPassword);

      await tx
        .update(customers)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(customers.id, customer.id));

      // Revoke ALL active sessions on password reset
      await this.sessionService.revokeAllCustomerSessions(customer.id, tx);

      await this.outboxService.enqueue(tx, {
        eventType: 'identity.email_requested',
        aggregateType: 'customer',
        aggregateId: customer.id,
        payload: {
          kind: 'password_changed',
          customerId: customer.id,
        },
      });
    });

    return { reset: true };
  }

  async changePassword(input: {
    customerId: string;
    currentSessionId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<{ changed: true }> {
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(eq(customers.id, input.customerId))
      .limit(1);

    if (!customer || !customer.isActive) {
      throw unauthenticatedError();
    }

    const valid = await this.passwordService.verify(customer.passwordHash, input.currentPassword);
    if (!valid) {
      throw invalidCredentialsError();
    }

    const normalizedNew = this.passwordService.validatePolicy(input.newPassword, customer.email);
    const newHash = await this.passwordService.hash(normalizedNew);

    await this.databaseService.db.transaction(async (tx) => {
      await tx
        .update(customers)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(customers.id, customer.id));

      // Revoke all OTHER sessions, keeping the current authenticated session active
      await this.sessionService.revokeOtherCustomerSessions(
        customer.id,
        input.currentSessionId,
        tx,
      );

      await this.outboxService.enqueue(tx, {
        eventType: 'identity.email_requested',
        aggregateType: 'customer',
        aggregateId: customer.id,
        payload: {
          kind: 'password_changed',
          customerId: customer.id,
        },
      });
    });

    return { changed: true };
  }
}
