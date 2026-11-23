import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, sql } from 'drizzle-orm';
import {
  apiErrorResponseSchema,
  changePasswordResponseSchema,
  csrfTokenResponseSchema,
  genericAcceptedResponseSchema,
  resetPasswordResponseSchema,
  verifyEmailResponseSchema,
} from '@minieshop/contracts';
import { createApp } from '../app.factory.js';
import { loadEnv, resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { emailTokens } from '../database/schema/index.js';
import {
  InMemoryMailTransport,
  MAIL_TRANSPORT_TOKEN,
  MailerOutboxHandler,
  RATE_LIMITER_TOKEN,
  type RateLimiter,
} from '../modules/identity/index.js';
import { OutboxService } from '../modules/platform/index.js';
import { OutboxWorkerRunner } from '../worker/worker.runner.js';
import { ensureTestDatabaseReady, getTestDatabaseUrl } from './integration-db.js';

const ORIGIN = 'http://localhost:5199';

function extractCookiePair(setCookie: string | string[] | undefined, name: string): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const found = list.find((entry) => entry.startsWith(`${name}=`));
  if (!found) {
    throw new Error(`Missing cookie ${name}`);
  }
  return found.split(';')[0]!;
}

function extractTokenFromUrl(textOrHtml: string, pathSegment: string): string {
  const regex = new RegExp(`${pathSegment}\\?token=([^\\s"&<]+)`);
  const match = textOrHtml.match(regex);
  if (!match?.[1]) {
    throw new Error(`Token not found for ${pathSegment}`);
  }
  return decodeURIComponent(match[1]);
}

describe('I03 — Email Verification, Password Reset & Change Password Flows', () => {
  const testDbUrl = getTestDatabaseUrl();
  let app: NestFastifyApplication;
  let dbService: DatabaseService;
  let mailTransport: InMemoryMailTransport;
  let rateLimiter: RateLimiter;
  let runner: OutboxWorkerRunner;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = testDbUrl;
    process.env.S3_ENDPOINT = 'http://localhost:8333';
    process.env.S3_PUBLIC_ENDPOINT = 'http://localhost:8333';
    process.env.S3_ACCESS_KEY_ID = 'test';
    process.env.S3_SECRET_ACCESS_KEY = 'test';
    process.env.S3_PUBLIC_BUCKET = 'pub';
    process.env.S3_PRIVATE_BUCKET = 'priv';
    process.env.CORS_ORIGINS = ORIGIN;
    process.env.STOREFRONT_URL = ORIGIN;
    process.env.MAIL_TRANSPORT = 'memory';
    process.env.ARGON2_MEMORY_COST = '4096';
    process.env.ARGON2_TIME_COST = '1';
    process.env.ARGON2_PARALLELISM = '1';
    resetEnvCache();

    await ensureTestDatabaseReady(testDbUrl);
    const created = await createApp({ env: loadEnv() });
    app = created.app;
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    dbService = app.get(DatabaseService);
    mailTransport = app.get<InMemoryMailTransport>(MAIL_TRANSPORT_TOKEN);
    rateLimiter = app.get(RATE_LIMITER_TOKEN);

    const outboxService = app.get(OutboxService);
    const mailerHandler = app.get(MailerOutboxHandler);
    runner = new OutboxWorkerRunner({
      outboxService,
      handlers: {
        mailer: async (event) => {
          await mailerHandler.handle(event);
        },
      },
      logger: created.logger,
    });
  });

  afterAll(async () => {
    await app.close();
    delete process.env.MAIL_TRANSPORT;
    delete process.env.ARGON2_MEMORY_COST;
    delete process.env.ARGON2_TIME_COST;
    delete process.env.ARGON2_PARALLELISM;
    resetEnvCache();
  });

  beforeEach(async () => {
    rateLimiter.clearAll();
    mailTransport.clear();
    await dbService.db.execute(
      sql`TRUNCATE TABLE "identity"."sessions", "identity"."email_tokens", "identity"."customers", "platform"."outbox" RESTART IDENTITY CASCADE`,
    );
  });

  it('completes register -> verify-email (one-time) -> login -> forgot-password (anti-enum) -> reset-password (revokes sessions) -> change-password', async () => {
    // 1. Register
    const regRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { origin: ORIGIN },
      payload: {
        email: 'diana@example.com',
        password: 'primeira-senha-forte-2026',
        fullName: 'Diana Rocha',
      },
    });
    expect(regRes.statusCode).toBe(202);
    await runner.processNextBatch();

    expect(mailTransport.getSent()).toHaveLength(1);
    const verifyMsg = mailTransport.getSent()[0]!;
    expect(verifyMsg.to).toBe('diana@example.com');
    expect(verifyMsg.html).toContain(`${ORIGIN}/verify-email?token=`);
    expect(verifyMsg.text).toContain('Diana Rocha');
    const verifyToken = extractTokenFromUrl(verifyMsg.text, '/verify-email');

    // 2. Tampered token -> generic error
    const tamperedVerify = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      headers: { origin: ORIGIN },
      payload: { token: `${verifyToken}tampered` },
    });
    expect(tamperedVerify.statusCode).toBe(400);
    const tamperedErr = apiErrorResponseSchema.parse(tamperedVerify.json());

    // 3. Valid verification succeeds once
    const okVerify = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      headers: { origin: ORIGIN },
      payload: { token: verifyToken },
    });
    expect(okVerify.statusCode).toBe(200);
    expect(verifyEmailResponseSchema.parse(okVerify.json())).toEqual({ verified: true });

    // 4. Reusing verification token -> exact same error as tampered token
    const reusedVerify = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      headers: { origin: ORIGIN },
      payload: { token: verifyToken },
    });
    expect(reusedVerify.statusCode).toBe(400);
    expect(apiErrorResponseSchema.parse(reusedVerify.json()).error.message).toBe(
      tamperedErr.error.message,
    );

    // 5. Login with 2 separate devices
    const loginA = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN },
      payload: { email: 'diana@example.com', password: 'primeira-senha-forte-2026' },
    });
    expect(loginA.statusCode).toBe(200);
    const cookieA = extractCookiePair(loginA.headers['set-cookie'], 'sid_customer');

    const loginB = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN },
      payload: { email: 'diana@example.com', password: 'primeira-senha-forte-2026' },
    });
    expect(loginB.statusCode).toBe(200);
    const cookieB = extractCookiePair(loginB.headers['set-cookie'], 'sid_customer');

    // 6. Forgot password anti-enumeration (existing vs nonexistent identical 202)
    mailTransport.clear();
    const forgotExisting = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      headers: { origin: ORIGIN },
      payload: { email: 'diana@example.com' },
    });
    const forgotMissing = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      headers: { origin: ORIGIN },
      payload: { email: 'ghost@example.com' },
    });
    expect(forgotExisting.statusCode).toBe(202);
    expect(forgotMissing.statusCode).toBe(202);
    expect(genericAcceptedResponseSchema.parse(forgotExisting.json())).toEqual(
      genericAcceptedResponseSchema.parse(forgotMissing.json()),
    );

    await runner.processNextBatch();
    expect(mailTransport.getSent()).toHaveLength(1);
    const resetToken = extractTokenFromUrl(mailTransport.getSent()[0]!.text, '/reset-password');

    // 7. Reset password -> revokes ALL sessions and queues password_changed email
    mailTransport.clear();
    const resetRes = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      headers: { origin: ORIGIN },
      payload: { token: resetToken, newPassword: 'segunda-senha-muito-forte-2026' },
    });
    expect(resetRes.statusCode).toBe(200);
    expect(resetPasswordResponseSchema.parse(resetRes.json())).toEqual({ reset: true });

    // Both previous sessions are now revoked!
    expect((await app.inject({ method: 'GET', url: '/me', headers: { cookie: cookieA } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/me', headers: { cookie: cookieB } })).statusCode).toBe(401);

    // password_changed email delivered
    await runner.processNextBatch();
    expect(mailTransport.getSent()).toHaveLength(1);
    expect(mailTransport.getSent()[0]!.subject).toContain('senha foi alterada');

    // Reusing reset token fails with same generic error
    const reuseReset = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      headers: { origin: ORIGIN },
      payload: { token: resetToken, newPassword: 'terceira-senha-forte-2026' },
    });
    expect(reuseReset.statusCode).toBe(400);
    expect(apiErrorResponseSchema.parse(reuseReset.json()).error.message).toBe(
      tamperedErr.error.message,
    );

    // 8. Login again on 2 devices, then change-password -> revokes OTHER session, keeps current session!
    const dev1 = extractCookiePair(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/login',
          headers: { origin: ORIGIN },
          payload: { email: 'diana@example.com', password: 'segunda-senha-muito-forte-2026' },
        })
      ).headers['set-cookie'],
      'sid_customer',
    );
    const dev2 = extractCookiePair(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/login',
          headers: { origin: ORIGIN },
          payload: { email: 'diana@example.com', password: 'segunda-senha-muito-forte-2026' },
        })
      ).headers['set-cookie'],
      'sid_customer',
    );

    const csrfDev1 = csrfTokenResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/auth/csrf', headers: { cookie: dev1 } })).json(),
    ).csrfToken;

    const changeRes = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { origin: ORIGIN, cookie: dev1, 'x-csrf-token': csrfDev1 },
      payload: {
        currentPassword: 'segunda-senha-muito-forte-2026',
        newPassword: 'terceira-senha-super-forte-2026',
      },
    });
    expect(changeRes.statusCode).toBe(200);
    expect(changePasswordResponseSchema.parse(changeRes.json())).toEqual({ changed: true });

    // dev1 stays active, dev2 is revoked!
    expect((await app.inject({ method: 'GET', url: '/me', headers: { cookie: dev1 } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/me', headers: { cookie: dev2 } })).statusCode).toBe(401);
  });

  it('rejects expired tokens with the same error and skips stale tokens in state-based mailer', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { origin: ORIGIN },
      payload: {
        email: 'expired@example.com',
        password: 'minha-senha-valida-2026',
        fullName: 'Expired User',
      },
    });

    // Request a resend before draining outbox -> old token is invalidated!
    const resendRes = await app.inject({
      method: 'POST',
      url: '/auth/resend-verification',
      headers: { origin: ORIGIN },
      payload: { email: 'expired@example.com' },
    });
    expect(resendRes.statusCode).toBe(202);

    // State-based mailer processes both outbox events, but ONLY sends the latest active token!
    await runner.processNextBatch();
    expect(mailTransport.getSent()).toHaveLength(1);
    const latestToken = extractTokenFromUrl(mailTransport.getSent()[0]!.text, '/verify-email');

    // Force-expire the token in DB
    const tokenId = latestToken.split('.')[0]!;
    await dbService.db
      .update(emailTokens)
      .set({ expiresAt: new Date(Date.now() - 10_000) })
      .where(eq(emailTokens.id, tokenId));

    const expiredRes = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      headers: { origin: ORIGIN },
      payload: { token: latestToken },
    });
    expect(expiredRes.statusCode).toBe(400);
    expect(apiErrorResponseSchema.parse(expiredRes.json()).error.message).toBe(
      'Invalid or expired token',
    );
  });
});
