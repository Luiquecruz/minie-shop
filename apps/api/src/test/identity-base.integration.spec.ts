import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { loadEnv, resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { customers, sessions } from '../database/schema/index.js';
import { createApp } from '../app.factory.js';
import type { Clock } from '../common/clock.js';
import {
  PasswordService,
  SessionService,
  hashSessionToken,
} from '../modules/identity/index.js';
import { ensureTestDatabaseReady, getTestDatabaseUrl } from './integration-db.js';

class ControllableClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return new Date(this.current.getTime());
  }
  advanceSeconds(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }
}

describe('I01 — Sessions, Expiration (Idle & Absolute), Hashing, Helmet & CSRF Integration', () => {
  const testDbUrl = getTestDatabaseUrl();
  let dbService: DatabaseService;
  let clock: ControllableClock;
  let sessionService: SessionService;
  let passwordService: PasswordService;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = testDbUrl;
    process.env.S3_ENDPOINT = 'http://localhost:8333';
    process.env.S3_PUBLIC_ENDPOINT = 'http://localhost:8333';
    process.env.S3_ACCESS_KEY_ID = 'test';
    process.env.S3_SECRET_ACCESS_KEY = 'test';
    process.env.S3_PUBLIC_BUCKET = 'pub';
    process.env.S3_PRIVATE_BUCKET = 'priv';
    process.env.CORS_ORIGINS = 'http://localhost:5199';
    process.env.CUSTOMER_SESSION_IDLE_TTL_SECONDS = '600';
    process.env.CUSTOMER_SESSION_ABSOLUTE_TTL_SECONDS = '1800';
    process.env.SESSION_TOUCH_THRESHOLD_SECONDS = '120';
    resetEnvCache();

    await ensureTestDatabaseReady(testDbUrl);
    dbService = new DatabaseService();
    passwordService = new PasswordService();
  });

  afterAll(async () => {
    delete process.env.CUSTOMER_SESSION_IDLE_TTL_SECONDS;
    delete process.env.CUSTOMER_SESSION_ABSOLUTE_TTL_SECONDS;
    delete process.env.SESSION_TOUCH_THRESHOLD_SECONDS;
    resetEnvCache();
    await dbService.onModuleDestroy();
  });

  beforeEach(async () => {
    await dbService.db.execute(
      sql`TRUNCATE TABLE "identity"."sessions", "identity"."customers" RESTART IDENTITY CASCADE`,
    );
    clock = new ControllableClock(new Date('2026-11-22T12:00:00.000Z'));
    sessionService = new SessionService(dbService, clock);
  });

  it('stores only SHA-256 token hash, slides idle TTL with floor, enforces idle & absolute expiry, revokes and cleans up', async () => {
    const hash = await passwordService.hash('minha-senha-segura-2026', {
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
    const [customer] = await dbService.db
      .insert(customers)
      .values({
        email: 'alice@example.com',
        passwordHash: hash,
        fullName: 'Alice',
        emailVerifiedAt: new Date(),
      })
      .returning();

    const created = await sessionService.createSession({
      subjectType: 'customer',
      subjectId: customer!.id,
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });

    // Verify DB stores ONLY SHA-256 hash, never raw token
    const [stored] = await dbService.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, created.sessionId));
    expect(stored).toBeDefined();
    expect(stored!.tokenHash).toBe(hashSessionToken(created.rawToken));
    expect(stored!.tokenHash).not.toBe(created.rawToken);

    // Within touch threshold (60s < 120s): resolves without updating lastSeenAt
    clock.advanceSeconds(60);
    const p1 = await sessionService.resolveCustomerSession(created.rawToken);
    expect(p1?.customerId).toBe(customer!.id);
    const [afterEarlyTouch] = await dbService.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, created.sessionId));
    expect(afterEarlyTouch!.lastSeenAt.toISOString()).toBe('2026-11-22T12:00:00.000Z');

    // Past touch threshold (another 120s -> +180s total): slides idle TTL
    clock.advanceSeconds(120);
    const p2 = await sessionService.resolveCustomerSession(created.rawToken);
    expect(p2?.customerId).toBe(customer!.id);
    const [afterSlide] = await dbService.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, created.sessionId));
    expect(afterSlide!.lastSeenAt.toISOString()).toBe('2026-11-22T12:03:00.000Z');
    expect(afterSlide!.expiresAt.toISOString()).toBe('2026-11-22T12:13:00.000Z');

    // Advance past idle TTL (601s from lastSeenAt) -> expired!
    clock.advanceSeconds(601);
    const expiredIdle = await sessionService.resolveCustomerSession(created.rawToken);
    expect(expiredIdle).toBeNull();

    // New session: keep touching every 300s until past absolute TTL (1800s)
    const created2 = await sessionService.createSession({
      subjectType: 'customer',
      subjectId: customer!.id,
    });
    expect(created2.rawToken).not.toBe(created.rawToken);

    for (let i = 0; i < 5; i += 1) {
      clock.advanceSeconds(300);
      expect(await sessionService.resolveCustomerSession(created2.rawToken)).not.toBeNull();
    }
    // Now at +1500s; advance 301s -> +1801s (past absolute TTL of 1800s even though idle would be alive)
    clock.advanceSeconds(301);
    expect(await sessionService.resolveCustomerSession(created2.rawToken)).toBeNull();

    // Revocation invalidates immediately
    const created3 = await sessionService.createSession({
      subjectType: 'customer',
      subjectId: customer!.id,
    });
    expect(await sessionService.resolveCustomerSession(created3.rawToken)).not.toBeNull();
    await sessionService.revokeSession(created3.sessionId);
    expect(await sessionService.resolveCustomerSession(created3.rawToken)).toBeNull();

    // Cleanup removes expired & revoked sessions
    const cleanup = await sessionService.cleanupExpiredSessions();
    expect(cleanup.skipped).toBe(false);
    expect(cleanup.deleted).toBe(3);
  });

  it('applies helmet security headers and rejects state-changing requests without valid Origin', async () => {
    const { app } = await createApp({ env: loadEnv() });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    try {
      const healthRes = await app.inject({ method: 'GET', url: '/health' });
      expect(healthRes.statusCode).toBe(200);
      expect(healthRes.headers['x-content-type-options']).toBe('nosniff');
      expect(healthRes.headers['x-frame-options']).toBe('DENY');
      expect(healthRes.headers['x-powered-by']).toBeUndefined();

      // Missing Origin on state-changing route -> 403 CSRF_INVALID
      const missingOrigin = await app.inject({
        method: 'POST',
        url: '/favorites/00000000-0000-4000-8000-000000000000',
      });
      expect(missingOrigin.statusCode).toBe(403);
      expect(missingOrigin.json().error.code).toBe('CSRF_INVALID');

      // Disallowed Origin -> 403 CSRF_INVALID
      const badOrigin = await app.inject({
        method: 'POST',
        url: '/favorites/00000000-0000-4000-8000-000000000000',
        headers: { origin: 'https://evil.example' },
      });
      expect(badOrigin.statusCode).toBe(403);
      expect(badOrigin.json().error.code).toBe('CSRF_INVALID');
    } finally {
      await app.close();
    }
  });
});
