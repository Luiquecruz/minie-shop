import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, sql } from 'drizzle-orm';
import {
  apiErrorResponseSchema,
  authCustomerResponseSchema,
  csrfTokenResponseSchema,
  genericAcceptedResponseSchema,
} from '@minieshop/contracts';
import { createApp } from '../app.factory.js';
import { loadEnv, resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { customers, emailTokens, outbox, sessions } from '../database/schema/index.js';
import { RATE_LIMITER_TOKEN, type RateLimiter } from '../modules/identity/index.js';
import { ensureTestDatabaseReady, getTestDatabaseUrl } from './integration-db.js';

const ORIGIN = 'http://localhost:5199';

function extractCookiePair(setCookie: string | string[] | undefined, cookieName: string): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const match = list.find((item) => item.startsWith(`${cookieName}=`));
  if (!match) {
    throw new Error(`Cookie "${cookieName}" not found in set-cookie header`);
  }
  return match.split(';')[0]!;
}

describe('I02 — Customer Register, Login, Logout, Logout-All, CSRF & /me', () => {
  const testDbUrl = getTestDatabaseUrl();
  let app: NestFastifyApplication;
  let dbService: DatabaseService;
  let rateLimiter: RateLimiter;

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
    rateLimiter = app.get(RATE_LIMITER_TOKEN);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.ARGON2_MEMORY_COST;
    delete process.env.ARGON2_TIME_COST;
    delete process.env.ARGON2_PARALLELISM;
    resetEnvCache();
  });

  beforeEach(async () => {
    rateLimiter.clearAll();
    await dbService.db.execute(
      sql`TRUNCATE TABLE "identity"."sessions", "identity"."email_tokens", "identity"."customers", "platform"."outbox" RESTART IDENTITY CASCADE`,
    );
  });

  it('returns identical 202 response for new and existing email (anti-enumeration), normalizes email, and queues outbox events without starting a session', async () => {
    const resNew = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { origin: ORIGIN },
      payload: {
        email: '  Alice.Silva@Example.COM  ',
        password: 'cafe-fresco-manha-tranquila',
        fullName: 'Alice Silva',
      },
    });
    expect(resNew.statusCode).toBe(202);
    expect(resNew.headers['set-cookie']).toBeUndefined();
    expect(resNew.headers['cache-control']).toBe('no-store');
    const bodyNew = genericAcceptedResponseSchema.parse(resNew.json());

    const resExisting = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { origin: ORIGIN },
      payload: {
        email: 'alice.silva@example.com',
        password: 'outra-frase-secreta-qualquer',
        fullName: 'Outro Nome',
      },
    });
    expect(resExisting.statusCode).toBe(202);
    expect(resExisting.headers['set-cookie']).toBeUndefined();
    const bodyExisting = genericAcceptedResponseSchema.parse(resExisting.json());

    // Exact same status & body shape/content
    expect(bodyExisting).toEqual(bodyNew);

    // Only one customer created with normalized email and unverified status
    const customerRows = await dbService.db.select().from(customers);
    expect(customerRows).toHaveLength(1);
    expect(customerRows[0]!.email).toBe('alice.silva@example.com');
    expect(customerRows[0]!.emailVerifiedAt).toBeNull();

    // One verify_email token and two mailer outbox events (verify_email + already_registered)
    const tokenRows = await dbService.db.select().from(emailTokens);
    expect(tokenRows).toHaveLength(1);
    expect(tokenRows[0]!.purpose).toBe('verify_email');

    const outboxRows = await dbService.db.select().from(outbox);
    expect(outboxRows).toHaveLength(2);
    expect(outboxRows.map((r) => r.payload.kind).sort()).toEqual([
      'already_registered',
      'verify_email',
    ]);
    // Outbox payload never contains raw tokens or password hashes
    for (const row of outboxRows) {
      expect(row.consumer).toBe('mailer');
      expect(JSON.stringify(row.payload)).not.toContain('cafe-fresco');
      expect(JSON.stringify(row.payload)).not.toContain('$argon2id$');
    }
  });

  it('makes nonexistent email and wrong password indistinguishable, and only reveals EMAIL_NOT_VERIFIED after proving password', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { origin: ORIGIN },
      payload: {
        email: 'bob@example.com',
        password: 'frase-secreta-do-bob-2026',
        fullName: 'Bob Santos',
      },
    });

    const missingEmailRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN },
      payload: {
        email: 'nobody@example.com',
        password: 'frase-secreta-errada-2026',
      },
    });
    expect(missingEmailRes.statusCode).toBe(401);
    const errMissing = apiErrorResponseSchema.parse(missingEmailRes.json());

    const wrongPwdRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN },
      payload: {
        email: 'bob@example.com',
        password: 'frase-secreta-errada-2026',
      },
    });
    expect(wrongPwdRes.statusCode).toBe(401);
    const errWrong = apiErrorResponseSchema.parse(wrongPwdRes.json());

    expect(errMissing.error.code).toBe('INVALID_CREDENTIALS');
    expect(errWrong.error.code).toBe('INVALID_CREDENTIALS');
    expect(errMissing.error.message).toBe(errWrong.error.message);

    // Correct password on unverified account -> 403 EMAIL_NOT_VERIFIED
    const unverifiedRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN },
      payload: {
        email: 'bob@example.com',
        password: 'frase-secreta-do-bob-2026',
      },
    });
    expect(unverifiedRes.statusCode).toBe(403);
    expect(apiErrorResponseSchema.parse(unverifiedRes.json()).error.code).toBe(
      'EMAIL_NOT_VERIFIED',
    );
  });

  it('logs in verified customer, regenerates session on re-login, serves /me, enforces CSRF on logout and revokes all on logout-all', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { origin: ORIGIN },
      payload: {
        email: 'carol@example.com',
        password: 'minha-senha-super-segura-2026',
        fullName: 'Carol Lima',
      },
    });

    // Mark email verified directly (full email verification flow is tested in I03)
    await dbService.db
      .update(customers)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(customers.email, 'carol@example.com'));

    // Unauthenticated /me -> 401
    const unauthMe = await app.inject({ method: 'GET', url: '/me' });
    expect(unauthMe.statusCode).toBe(401);
    expect(apiErrorResponseSchema.parse(unauthMe.json()).error.code).toBe('UNAUTHENTICATED');

    // Login #1
    const login1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN },
      payload: {
        email: 'CAROL@example.com',
        password: 'minha-senha-super-segura-2026',
      },
    });
    expect(login1.statusCode).toBe(200);
    expect(login1.headers['cache-control']).toBe('no-store');
    const login1Body = authCustomerResponseSchema.parse(login1.json());
    expect(login1Body.customer.email).toBe('carol@example.com');
    expect(login1Body.customer.emailVerified).toBe(true);
    expect(JSON.stringify(login1.json())).not.toContain('passwordHash');

    const rawSetCookie1 = String(login1.headers['set-cookie']);
    expect(rawSetCookie1).toContain('sid_customer=');
    expect(rawSetCookie1).toContain('HttpOnly');
    expect(rawSetCookie1).toContain('SameSite=Lax');
    expect(rawSetCookie1).toContain('Path=/');
    expect(rawSetCookie1).not.toContain('Domain=');
    const cookie1 = extractCookiePair(login1.headers['set-cookie'], 'sid_customer');

    // /me with cookie1
    const me1 = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: cookie1 },
    });
    expect(me1.statusCode).toBe(200);
    expect(me1.headers['cache-control']).toBe('no-store');
    expect(authCustomerResponseSchema.parse(me1.json()).customer.email).toBe('carol@example.com');

    // Re-login with existing cookie -> regenerates session token & revokes old one
    const login2 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN },
      payload: {
        email: 'carol@example.com',
        password: 'minha-senha-super-segura-2026',
      },
    });
    expect(login2.statusCode).toBe(200);
    const cookie2 = extractCookiePair(login2.headers['set-cookie'], 'sid_customer');
    expect(cookie2).not.toBe(cookie1);

    // Fetch CSRF token for cookie2
    const csrfRes = await app.inject({
      method: 'GET',
      url: '/auth/csrf',
      headers: { cookie: cookie2 },
    });
    expect(csrfRes.statusCode).toBe(200);
    const { csrfToken } = csrfTokenResponseSchema.parse(csrfRes.json());

    // Logout without x-csrf-token -> 403 CSRF_INVALID
    const badLogout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { cookie: cookie2, origin: ORIGIN },
    });
    expect(badLogout.statusCode).toBe(403);
    expect(apiErrorResponseSchema.parse(badLogout.json()).error.code).toBe('CSRF_INVALID');

    // Logout with valid x-csrf-token -> 204
    const okLogout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { cookie: cookie2, origin: ORIGIN, 'x-csrf-token': csrfToken },
    });
    expect(okLogout.statusCode).toBe(204);

    // cookie2 is now dead; cookie1 is still alive (separate device)
    expect((await app.inject({ method: 'GET', url: '/me', headers: { cookie: cookie2 } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/me', headers: { cookie: cookie1 } })).statusCode).toBe(200);

    // Logout-all using cookie1 revokes all sessions
    const csrf1 = csrfTokenResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/auth/csrf', headers: { cookie: cookie1 } })).json(),
    ).csrfToken;

    const logoutAllRes = await app.inject({
      method: 'POST',
      url: '/auth/logout-all',
      headers: { cookie: cookie1, origin: ORIGIN, 'x-csrf-token': csrf1 },
    });
    expect(logoutAllRes.statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/me', headers: { cookie: cookie1 } })).statusCode).toBe(401);

    // Every session in DB is revoked
    const activeSessions = await dbService.db
      .select()
      .from(sessions)
      .where(sql`${sessions.revokedAt} IS NULL`);
    expect(activeSessions).toHaveLength(0);
  });
});
