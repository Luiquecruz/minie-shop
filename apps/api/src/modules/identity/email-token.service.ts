import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { CLOCK_TOKEN, SystemClock, type Clock } from '../../common/clock.js';
import { AppHttpError } from '../../common/errors.js';
import { loadEnv } from '../../config/env.js';
import { DatabaseService } from '../../database/database.service.js';
import { emailTokens } from '../../database/schema/identity.js';
import type { DbOrTx } from '../platform/index.js';

export type EmailTokenPurpose = 'verify_email' | 'reset_password';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TOKEN_TTL_MS: Record<EmailTokenPurpose, number> = {
  verify_email: 24 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
};

export function invalidEmailTokenError(): AppHttpError {
  return new AppHttpError({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: 'Invalid or expired token',
  });
}

@Injectable()
export class EmailTokenService {
  private readonly clock: Clock;

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Optional()
    @Inject(CLOCK_TOKEN)
    clock?: Clock,
  ) {
    this.clock = clock ?? new SystemClock();
  }

  signToken(params: {
    id: string;
    purpose: EmailTokenPurpose;
    customerId: string;
    expiresAt: Date;
    secretOverride?: string;
  }): string {
    const secret = params.secretOverride ?? loadEnv().EMAIL_TOKEN_SECRET;
    const mac = createHmac('sha256', secret)
      .update(`${params.id}:${params.purpose}:${params.customerId}:${params.expiresAt.toISOString()}`)
      .digest('base64url');
    return `${params.id}.${mac}`;
  }

  hashSignedToken(signedToken: string): string {
    return createHash('sha256').update(signedToken, 'utf8').digest('hex');
  }

  async issueToken(params: {
    customerId: string;
    purpose: EmailTokenPurpose;
    tx?: DbOrTx;
  }): Promise<{ emailTokenId: string; expiresAt: Date }> {
    const executor = params.tx ?? this.databaseService.db;
    const now = this.clock.now();

    // Invalidate any previous unconsumed tokens of the same purpose for this customer
    await executor
      .update(emailTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(emailTokens.customerId, params.customerId),
          eq(emailTokens.purpose, params.purpose),
          isNull(emailTokens.consumedAt),
        ),
      );

    const id = randomUUID();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS[params.purpose]);
    const signedToken = this.signToken({
      id,
      purpose: params.purpose,
      customerId: params.customerId,
      expiresAt,
    });
    const tokenHash = this.hashSignedToken(signedToken);

    await executor.insert(emailTokens).values({
      id,
      customerId: params.customerId,
      tokenHash,
      purpose: params.purpose,
      expiresAt,
    });

    return { emailTokenId: id, expiresAt };
  }

  async getActiveTokenForMailer(emailTokenId: string): Promise<{
    id: string;
    customerId: string;
    purpose: EmailTokenPurpose;
    expiresAt: Date;
    signedToken: string;
  } | null> {
    if (!UUID_REGEX.test(emailTokenId)) {
      return null;
    }
    const now = this.clock.now();
    const [row] = await this.databaseService.db
      .select()
      .from(emailTokens)
      .where(eq(emailTokens.id, emailTokenId))
      .limit(1);

    if (!row || row.consumedAt !== null || now.getTime() >= row.expiresAt.getTime()) {
      return null;
    }

    const purpose = row.purpose as EmailTokenPurpose;
    const signedToken = this.signToken({
      id: row.id,
      purpose,
      customerId: row.customerId,
      expiresAt: row.expiresAt,
    });

    return {
      id: row.id,
      customerId: row.customerId,
      purpose,
      expiresAt: row.expiresAt,
      signedToken,
    };
  }

  async verifyAndConsumeToken(
    rawToken: string,
    expectedPurpose: EmailTokenPurpose,
    tx?: DbOrTx,
  ): Promise<{ customerId: string; emailTokenId: string }> {
    const parts = rawToken.split('.');
    if (parts.length !== 2) {
      throw invalidEmailTokenError();
    }
    const [id, providedSig] = parts;
    if (!id || !providedSig || !UUID_REGEX.test(id)) {
      throw invalidEmailTokenError();
    }

    const executor = tx ?? this.databaseService.db;
    const now = this.clock.now();

    const [row] = await executor
      .select()
      .from(emailTokens)
      .where(eq(emailTokens.id, id))
      .limit(1);

    if (
      !row ||
      row.purpose !== expectedPurpose ||
      row.consumedAt !== null ||
      now.getTime() >= row.expiresAt.getTime()
    ) {
      throw invalidEmailTokenError();
    }

    const expectedSigned = this.signToken({
      id: row.id,
      purpose: expectedPurpose,
      customerId: row.customerId,
      expiresAt: row.expiresAt,
    });

    const expectedBuf = Buffer.from(expectedSigned, 'utf8');
    const providedBuf = Buffer.from(rawToken, 'utf8');
    if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
      throw invalidEmailTokenError();
    }

    const providedHash = this.hashSignedToken(rawToken);
    const storedHashBuf = Buffer.from(row.tokenHash, 'utf8');
    const providedHashBuf = Buffer.from(providedHash, 'utf8');
    if (
      storedHashBuf.length !== providedHashBuf.length ||
      !timingSafeEqual(storedHashBuf, providedHashBuf)
    ) {
      throw invalidEmailTokenError();
    }

    const [consumed] = await executor
      .update(emailTokens)
      .set({ consumedAt: now })
      .where(and(eq(emailTokens.id, row.id), isNull(emailTokens.consumedAt)))
      .returning({ id: emailTokens.id, customerId: emailTokens.customerId });

    if (!consumed) {
      throw invalidEmailTokenError();
    }

    return { customerId: consumed.customerId, emailTokenId: consumed.id };
  }
}
