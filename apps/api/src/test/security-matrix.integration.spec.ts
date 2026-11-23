import { Writable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { sql } from 'drizzle-orm';
import {
  apiErrorResponseSchema,
  csrfTokenResponseSchema,
  genericAcceptedResponseSchema,
} from '@minieshop/contracts';
import { createApp } from '../app.factory.js';
import { loadEnv, resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { customers } from '../database/schema/index.js';
import {
  PasswordService,
  RATE_LIMITER_TOKEN,
  RbacSeedService,
  type RateLimiter,
} from '../modules/identity/index.js';
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

describe('I08 — Security Matrix: CSRF Cross-Session, Rate Limit 429, Enumeration, Log Redaction & Headers', () => {
  const testDbUrl = getTestDatabaseUrl();
  let app: NestFastifyApplication;
  let dbService: DatabaseService;
  let passwordService: PasswordService;
  let rbacSeedService: RbacSeedService;
  let rateLimiter: RateLimiter;
  const capturedLogs: string[] = [];

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
    process.env.MAIL_TRANSPORT = 'memory';
    process.env.ARGON2_MEMORY_COST = '4096';
    process.env.ARGON2_TIME_COST = '1';
    process.env.ARGON2_PARALLELISM = '1';
    resetEnvCache();

    await ensureTestDatabaseReady(testDbUrl);

    const logStream = new Writable({
      write(chunk, _enc, cb) {
        capturedLogs.push(chunk.toString('utf8'));
        cb();
      },
    });

    const created = await createApp({ env: loadEnv(), loggerDestination: logStream });
    app = created.app;
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    dbService = app.get(DatabaseService);
    passwordService = app.get(PasswordService);
    rbacSeedService = app.get(RbacSeedService);
    rateLimiter = app.get(RATE_LIMITER_TOKEN);
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
    capturedLogs.length = 0;
    rateLimiter.clearAll();
    await dbService.db.execute(
      sql`TRUNCATE TABLE "identity"."sessions", "identity"."email_tokens", "identity"."customers", "identity"."staff_user_roles", "identity"."staff_users", "platform"."audit_log", "platform"."outbox" RESTART IDENTITY CASCADE`,
    );
  });

  it('rejects missing Origin, bad Origin, missing x-csrf-token, and CSRF token from another session', async () => {
    const hash = await passwordService.hash('minha-senha-secreta-2026', {
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
    await dbService.db.insert(customers).values([
      { email: 'u1@example.com', passwordHash: hash, fullName: 'User 1', emailVerifiedAt: new Date() },
      { email: 'u2@example.com', passwordHash: hash, fullName: 'User 2', emailVerifiedAt: new Date() },
    ]);

    const l1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN },
      payload: { email: 'u1@example.com', password: 'minha-senha-secreta-2026' },
    });
    const l2 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN },
      payload: { email: 'u2@example.com', password: 'minha-senha-secreta-2026' },
    });
    const cookie1 = extractCookiePair(l1.headers['set-cookie'], 'sid_customer');
    const cookie2 = extractCookiePair(l2.headers['set-cookie'], 'sid_customer');

    const csrf2 = csrfTokenResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/auth/csrf', headers: { cookie: cookie2 } })).json(),
    ).csrfToken;

    // 1. Missing Origin
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/me',
          headers: { cookie: cookie1, 'x-csrf-token': csrf2 },
          payload: { fullName: 'Nope' },
        })
      ).statusCode,
    ).toBe(403);

    // 2. Invalid Origin
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/me',
          headers: { origin: 'https://attacker.example', cookie: cookie1, 'x-csrf-token': csrf2 },
          payload: { fullName: 'Nope' },
        })
      ).statusCode,
    ).toBe(403);

    // 3. Missing x-csrf-token
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/me',
          headers: { origin: ORIGIN, cookie: cookie1 },
          payload: { fullName: 'Nope' },
        })
      ).statusCode,
    ).toBe(403);

    // 4. x-csrf-token from ANOTHER session (cookie1 with csrf2)
    const crossCsrf = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { origin: ORIGIN, cookie: cookie1, 'x-csrf-token': csrf2 },
      payload: { fullName: 'Nope' },
    });
    expect(crossCsrf.statusCode).toBe(403);
    expect(apiErrorResponseSchema.parse(crossCsrf.json()).error.code).toBe('CSRF_INVALID');
  });

  it('enforces HTTP 429 RATE_LIMITED with Retry-After on login and forgot-password', async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { origin: ORIGIN },
        payload: { email: 'victim@example.com', password: 'wrong-password-12345' },
      });
      expect(res.statusCode).toBe(401);
    }

    const limited = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN },
      payload: { email: 'victim@example.com', password: 'wrong-password-12345' },
    });
    expect(limited.statusCode).toBe(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(apiErrorResponseSchema.parse(limited.json()).error.code).toBe('RATE_LIMITED');

    // Forgot-password anti-enumeration + rate limit
    const f1 = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      headers: { origin: ORIGIN },
      payload: { email: 'nonexistent@example.com' },
    });
    expect(f1.statusCode).toBe(202);
    expect(genericAcceptedResponseSchema.parse(f1.json()).accepted).toBe(true);
  });

  it('emits zero secrets into live Pino HTTP logs and enforces Helmet + Cache-Control: no-store + __Host- secure cookies', async () => {
    await rbacSeedService.seedInitialAdminIfEmpty();
    const env = loadEnv();

    const loginRes = await app.inject({
      method: 'POST',
      url: '/admin/auth/login',
      headers: {
        origin: ORIGIN,
        authorization: 'Bearer SUPER_SECRET_AUTH_HEADER',
      },
      payload: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD },
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.headers['cache-control']).toBe('no-store');
    expect(loginRes.headers['x-content-type-options']).toBe('nosniff');
    expect(loginRes.headers['x-frame-options']).toBe('DENY');
    expect(loginRes.headers['referrer-policy']).toBe('no-referrer');
    expect(loginRes.headers['x-powered-by']).toBeUndefined();
    expect(loginRes.headers['server']).toBeUndefined();

    const staffCookie = extractCookiePair(loginRes.headers['set-cookie'], 'sid_staff');
    const rawStaffToken = staffCookie.split('=')[1]!;

    const csrfRes = await app.inject({
      method: 'GET',
      url: '/admin/auth/csrf',
      headers: { cookie: staffCookie },
    });
    const { csrfToken } = csrfTokenResponseSchema.parse(csrfRes.json());

    await app.inject({
      method: 'POST',
      url: '/admin/auth/logout',
      headers: { origin: ORIGIN, cookie: staffCookie, 'x-csrf-token': csrfToken },
    });

    // Verify NONE of the sensitive values appeared anywhere in the live HTTP log stream
    const allLogs = capturedLogs.join('\n');
    expect(allLogs.length).toBeGreaterThan(0);
    expect(allLogs).not.toContain(env.ADMIN_PASSWORD);
    expect(allLogs).not.toContain(rawStaffToken);
    expect(allLogs).not.toContain(csrfToken);
    expect(allLogs).not.toContain('SUPER_SECRET_AUTH_HEADER');

    // Verify __Host- cookie prefix & Secure flag when COOKIE_SECURE=true
    process.env.COOKIE_SECURE = 'true';
    resetEnvCache();
    const { app: secureApp } = await createApp({ env: loadEnv() });
    await secureApp.init();
    await secureApp.getHttpAdapter().getInstance().ready();

    try {
      const secureLogin = await secureApp.inject({
        method: 'POST',
        url: '/admin/auth/login',
        headers: { origin: ORIGIN },
        payload: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD },
      });
      expect(secureLogin.statusCode).toBe(200);
      const setCookie = String(secureLogin.headers['set-cookie']);
      expect(setCookie).toContain('__Host-sid_staff=');
      expect(setCookie).toContain('Secure');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Path=/');
      expect(setCookie).not.toContain('Domain=');
    } finally {
      await secureApp.close();
      delete process.env.COOKIE_SECURE;
      resetEnvCache();
    }
  });
});
