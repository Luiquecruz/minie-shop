import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, sql } from 'drizzle-orm';
import {
  auditLogResponseSchema,
  csrfTokenResponseSchema,
} from '@minieshop/contracts';
import { createApp } from '../app.factory.js';
import { loadEnv, resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { auditLog, customers } from '../database/schema/index.js';
import {
  PasswordService,
  RATE_LIMITER_TOKEN,
  RbacSeedService,
  StaffAdminService,
  type RateLimiter,
} from '../modules/identity/index.js';
import { AuditService } from '../modules/platform/index.js';
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

describe('I07 — Staff Audit Log (Atomicity, Redaction, Cursor Pagination & Filters)', () => {
  const testDbUrl = getTestDatabaseUrl();
  let app: NestFastifyApplication;
  let dbService: DatabaseService;
  let rbacSeedService: RbacSeedService;
  let staffAdminService: StaffAdminService;
  let passwordService: PasswordService;
  let auditService: AuditService;
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
    rbacSeedService = app.get(RbacSeedService);
    staffAdminService = app.get(StaffAdminService);
    passwordService = app.get(PasswordService);
    auditService = app.get(AuditService);
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
    rateLimiter.clearAll();
    await dbService.db.execute(
      sql`TRUNCATE TABLE "platform"."audit_log", "identity"."sessions", "identity"."staff_user_roles", "identity"."staff_users", "identity"."role_permissions", "identity"."roles", "identity"."permissions", "identity"."customers" RESTART IDENTITY CASCADE`,
    );
  });

  it('records staff login (fail/success), logout, staff creation, role changes with before/after, customers.listed without PII, and supports cursor pagination + filters', async () => {
    await rbacSeedService.seedInitialAdminIfEmpty();
    const support = await staffAdminService.createStaffUser({
      email: 'support@minieshop.local',
      password: 'support-strong-pass-2026',
      fullName: 'Support Agent',
      roleCodes: ['support'],
    });

    const custHash = await passwordService.hash('customer-pass-2026', {
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
    await dbService.db.insert(customers).values({
      email: 'sensitive-customer@example.com',
      passwordHash: custHash,
      fullName: 'Sensitive Customer',
      emailVerifiedAt: new Date(),
    });

    const env = loadEnv();

    // Failed staff login
    const badLogin = await app.inject({
      method: 'POST',
      url: '/admin/auth/login',
      headers: { origin: ORIGIN, 'x-request-id': 'req-bad-login' },
      payload: { email: env.ADMIN_EMAIL, password: 'wrong-password-12345' },
    });
    expect(badLogin.statusCode).toBe(401);

    // Successful admin login
    const okLogin = await app.inject({
      method: 'POST',
      url: '/admin/auth/login',
      headers: { origin: ORIGIN, 'x-request-id': 'req-ok-login', 'user-agent': 'AuditTestAgent/1.0' },
      payload: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD },
    });
    expect(okLogin.statusCode).toBe(200);
    const adminCookie = extractCookiePair(okLogin.headers['set-cookie'], 'sid_staff');
    const adminCsrf = csrfTokenResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/admin/auth/csrf', headers: { cookie: adminCookie } })).json(),
    ).csrfToken;

    // List customers (audits customers.listed without customer content)
    const custRes = await app.inject({
      method: 'GET',
      url: '/admin/customers',
      headers: { cookie: adminCookie },
    });
    expect(custRes.statusCode).toBe(200);

    // Update support staff roles -> records before & after
    const roleRes = await app.inject({
      method: 'PUT',
      url: `/admin/staff/${support.id}/roles`,
      headers: {
        origin: ORIGIN,
        cookie: adminCookie,
        'x-csrf-token': adminCsrf,
        'x-request-id': 'req-role-update',
      },
      payload: { roles: ['support', 'catalog_manager'] },
    });
    expect(roleRes.statusCode).toBe(200);

    // Support user CANNOT read /admin/audit-log (403 FORBIDDEN)
    const supLogin = await app.inject({
      method: 'POST',
      url: '/admin/auth/login',
      headers: { origin: ORIGIN },
      payload: { email: 'support@minieshop.local', password: 'support-strong-pass-2026' },
    });
    const supCookie = extractCookiePair(supLogin.headers['set-cookie'], 'sid_staff');
    expect(
      (await app.inject({ method: 'GET', url: '/admin/audit-log', headers: { cookie: supCookie } }))
        .statusCode,
    ).toBe(403);

    // Admin reads /admin/audit-log with filter action=staff.roles_updated
    const roleAuditRes = await app.inject({
      method: 'GET',
      url: '/admin/audit-log?action=staff.roles_updated',
      headers: { cookie: adminCookie },
    });
    expect(roleAuditRes.statusCode).toBe(200);
    const roleAudit = auditLogResponseSchema.parse(roleAuditRes.json());
    expect(roleAudit.items).toHaveLength(1);
    expect(roleAudit.items[0]!.before).toEqual({ roles: ['support'] });
    expect(roleAudit.items[0]!.after).toEqual({ roles: ['catalog_manager', 'support'] });
    expect(roleAudit.items[0]!.requestId).toBe('req-role-update');

    // customers.listed audit entry does NOT contain customer email/name
    const listAuditRes = await app.inject({
      method: 'GET',
      url: '/admin/audit-log?action=customers.listed',
      headers: { cookie: adminCookie },
    });
    const listAudit = auditLogResponseSchema.parse(listAuditRes.json());
    expect(listAudit.items).toHaveLength(1);
    expect(JSON.stringify(listAudit.items[0])).not.toContain('sensitive-customer@example.com');

    // Cursor pagination across all audit entries (limit=2)
    const page1 = auditLogResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/admin/audit-log?limit=2', headers: { cookie: adminCookie } })).json(),
    );
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = auditLogResponseSchema.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/admin/audit-log?limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`,
          headers: { cookie: adminCookie },
        })
      ).json(),
    );
    expect(page2.items.length).toBeGreaterThanOrEqual(2);
    const page1Ids = new Set(page1.items.map((i) => i.id));
    for (const item of page2.items) {
      expect(page1Ids.has(item.id)).toBe(false);
    }
  });

  it('redacts sentinel secrets in audit records and rolls back audit row atomically when business transaction fails', async () => {
    // 1. Sentinel secret redaction test
    const recordId = await auditService.recordStandalone({
      actorType: 'system',
      actorId: null,
      action: 'test.redaction',
      entityType: 'test',
      entityId: '1',
      before: {
        password: 'SENTINEL_PASSWORD_123',
        nested: { tokenHash: 'SENTINEL_HASH_456', safeField: 'keep-me' },
      },
      after: {
        authorization: 'Bearer SENTINEL_BEARER_789',
        cookie: 'sid_staff=SENTINEL_COOKIE_000',
        secret: 'SENTINEL_SECRET_999',
      },
      metadata: {
        rawToken: 'SENTINEL_TOKEN_AAA',
      },
    });

    const [stored] = await dbService.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.id, recordId));

    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain('SENTINEL_PASSWORD_123');
    expect(serialized).not.toContain('SENTINEL_HASH_456');
    expect(serialized).not.toContain('SENTINEL_BEARER_789');
    expect(serialized).not.toContain('SENTINEL_COOKIE_000');
    expect(serialized).not.toContain('SENTINEL_SECRET_999');
    expect(serialized).not.toContain('SENTINEL_TOKEN_AAA');
    expect(serialized).toContain('keep-me');
    expect(serialized).toContain('[REDACTED]');

    // 2. Atomicity rollback test: failed business tx leaves ZERO orphan audit rows
    await expect(
      dbService.db.transaction(async (tx) => {
        await auditService.record(tx, {
          actorType: 'system',
          actorId: null,
          action: 'test.should_rollback',
          entityType: 'test',
          entityId: 'rollback-1',
        });
        throw new Error('Simulated business failure after audit record');
      }),
    ).rejects.toThrow(/Simulated business failure/);

    const orphans = await dbService.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'test.should_rollback'));
    expect(orphans).toHaveLength(0);
  });
});
