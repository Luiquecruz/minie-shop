import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants.js';
import { sql } from 'drizzle-orm';
import {
  adminCustomerListResponseSchema,
  adminMeResponseSchema,
  adminStaffListResponseSchema,
  apiErrorResponseSchema,
  csrfTokenResponseSchema,
  updateStaffRolesResponseSchema,
} from '@minieshop/contracts';
import { createApp } from '../app.factory.js';
import { loadEnv, resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { customers } from '../database/schema/index.js';
import {
  ALLOW_ANY_STAFF_KEY,
  PasswordService,
  PUBLIC_ADMIN_ROUTE_KEY,
  RATE_LIMITER_TOKEN,
  RbacSeedService,
  REQUIRE_PERMISSIONS_KEY,
  StaffAdminService,
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

describe('I04 — Staff Authentication, RBAC Matrix, Deny-by-Default & Cookie Isolation', () => {
  const testDbUrl = getTestDatabaseUrl();
  let app: NestFastifyApplication;
  let dbService: DatabaseService;
  let rbacSeedService: RbacSeedService;
  let staffAdminService: StaffAdminService;
  let passwordService: PasswordService;
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
      sql`TRUNCATE TABLE "identity"."sessions", "identity"."staff_user_roles", "identity"."staff_users", "identity"."role_permissions", "identity"."roles", "identity"."permissions", "identity"."customers" RESTART IDENTITY CASCADE`,
    );
  });

  it('DENY-BY-DEFAULT: every registered /admin/* route has explicit @RequirePermission, @AllowAnyStaff, or @PublicAdminRoute', () => {
    const modulesContainer = app.get(ModulesContainer);
    const metadataScanner = new MetadataScanner();
    const reflector = app.get(Reflector);

    const unprotectedAdminRoutes: string[] = [];
    let adminRouteCount = 0;

    for (const moduleRef of modulesContainer.values()) {
      for (const wrapper of moduleRef.controllers.values()) {
        const controllerClass = wrapper.metatype;
        const instance = wrapper.instance as Record<string, unknown> | undefined;
        if (!controllerClass || !instance) {
          continue;
        }
        const controllerPath = String(
          Reflect.getMetadata(PATH_METADATA, controllerClass) ?? '',
        ).replace(/^\/+|\/+$/g, '');

        const prototype = Object.getPrototypeOf(instance) as object;
        const methodNames = metadataScanner.getAllMethodNames(prototype);

        for (const methodName of methodNames) {
          const handler = (prototype as Record<string, unknown>)[methodName];
          if (typeof handler !== 'function') {
            continue;
          }
          const methodMeta = Reflect.getMetadata(METHOD_METADATA, handler);
          if (methodMeta === undefined) {
            continue;
          }
          const routePath = String(Reflect.getMetadata(PATH_METADATA, handler) ?? '').replace(
            /^\/+|\/+$/g,
            '',
          );
          const fullPath = `/${[controllerPath, routePath].filter(Boolean).join('/')}`;

          if (fullPath === '/admin' || fullPath.startsWith('/admin/')) {
            adminRouteCount += 1;
            const targets = [handler, controllerClass];
            const isPublic = reflector.getAllAndOverride<boolean>(PUBLIC_ADMIN_ROUTE_KEY, targets);
            const isAnyStaff = reflector.getAllAndOverride<boolean>(ALLOW_ANY_STAFF_KEY, targets);
            const perms = reflector.getAllAndOverride<string[] | undefined>(
              REQUIRE_PERMISSIONS_KEY,
              targets,
            );

            if (!isPublic && !isAnyStaff && (!perms || perms.length === 0)) {
              unprotectedAdminRoutes.push(`${controllerClass.name}.${methodName} (${fullPath})`);
            }
          }
        }
      }
    }

    expect(adminRouteCount).toBeGreaterThanOrEqual(8);
    expect(unprotectedAdminRoutes).toEqual([]);
  });

  it('enforces RBAC permission matrix across admin, catalog_manager, and support, least privilege, last-admin guard, and cross-cookie isolation', async () => {
    const seedRes = await rbacSeedService.seedInitialAdminIfEmpty();
    expect(seedRes.created).toBe(true);
    // Second call is idempotent
    expect((await rbacSeedService.seedInitialAdminIfEmpty()).created).toBe(false);

    // Create catalog_manager and support staff
    const catMgr = await staffAdminService.createStaffUser({
      email: 'catalog@minieshop.local',
      password: 'catalog-manager-pass-2026',
      fullName: 'Catalog Manager',
      roleCodes: ['catalog_manager'],
    });
    await staffAdminService.createStaffUser({
      email: 'support@minieshop.local',
      password: 'support-agent-pass-2026',
      fullName: 'Support Agent',
      roleCodes: ['support'],
    });

    // Seed a customer with phone number (to verify least privilege hides phone on /admin/customers)
    const custHash = await passwordService.hash('customer-strong-pass-2026', {
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
    await dbService.db.insert(customers).values({
      email: 'shopper@example.com',
      passwordHash: custHash,
      fullName: 'Shopper One',
      phone: '+5511999998888',
      emailVerifiedAt: new Date(),
    });

    const loginStaff = async (email: string, password: string) => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/auth/login',
        headers: { origin: ORIGIN },
        payload: { email, password },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      const cookie = extractCookiePair(res.headers['set-cookie'], 'sid_staff');
      const csrf = csrfTokenResponseSchema.parse(
        (await app.inject({ method: 'GET', url: '/admin/auth/csrf', headers: { cookie } })).json(),
      ).csrfToken;
      return { cookie, csrf, body: adminMeResponseSchema.parse(res.json()) };
    };

    const env = loadEnv();
    const admin = await loginStaff(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
    const catalog = await loginStaff('catalog@minieshop.local', 'catalog-manager-pass-2026');
    const support = await loginStaff('support@minieshop.local', 'support-agent-pass-2026');

    // Role matrix on GET /admin/customers (requires customers:read -> admin & support OK, catalog_manager 403)
    const adminCustomers = await app.inject({
      method: 'GET',
      url: '/admin/customers',
      headers: { cookie: admin.cookie },
    });
    expect(adminCustomers.statusCode).toBe(200);
    const custList = adminCustomerListResponseSchema.parse(adminCustomers.json());
    expect(custList.items).toHaveLength(1);
    expect(JSON.stringify(adminCustomers.json())).not.toContain('+5511999998888');
    expect(JSON.stringify(adminCustomers.json())).not.toContain('passwordHash');

    const supportCustomers = await app.inject({
      method: 'GET',
      url: '/admin/customers',
      headers: { cookie: support.cookie },
    });
    expect(supportCustomers.statusCode).toBe(200);

    const catalogCustomers = await app.inject({
      method: 'GET',
      url: '/admin/customers',
      headers: { cookie: catalog.cookie },
    });
    expect(catalogCustomers.statusCode).toBe(403);
    expect(apiErrorResponseSchema.parse(catalogCustomers.json()).error.code).toBe('FORBIDDEN');

    // Role matrix on GET /admin/staff (requires staff:manage -> ONLY admin OK)
    expect(
      (await app.inject({ method: 'GET', url: '/admin/staff', headers: { cookie: admin.cookie } }))
        .statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: '/admin/staff', headers: { cookie: support.cookie } }))
        .statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ method: 'GET', url: '/admin/staff', headers: { cookie: catalog.cookie } }))
        .statusCode,
    ).toBe(403);

    // Last-admin protection: admin cannot demote themselves when they are the sole admin
    const demoteSelf = await app.inject({
      method: 'PUT',
      url: `/admin/staff/${admin.body.staff.id}/roles`,
      headers: { origin: ORIGIN, cookie: admin.cookie, 'x-csrf-token': admin.csrf },
      payload: { roles: ['support'] },
    });
    expect(demoteSelf.statusCode).toBe(409);
    expect(apiErrorResponseSchema.parse(demoteSelf.json()).error.code).toBe('CONFLICT');

    // Admin promotes catalog_manager to also have support -> 200
    const updateCat = await app.inject({
      method: 'PUT',
      url: `/admin/staff/${catMgr.id}/roles`,
      headers: { origin: ORIGIN, cookie: admin.cookie, 'x-csrf-token': admin.csrf },
      payload: { roles: ['catalog_manager', 'support'] },
    });
    expect(updateCat.statusCode).toBe(200);
    expect(updateStaffRolesResponseSchema.parse(updateCat.json()).staff.roles).toEqual([
      'catalog_manager',
      'support',
    ]);

    // Now catalog_manager can read /admin/customers immediately
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/admin/customers',
          headers: { cookie: catalog.cookie },
        })
      ).statusCode,
    ).toBe(200);

    // Cross-cookie isolation: customer cookie CANNOT access /admin/me, staff cookie CANNOT access /me
    const custLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN },
      payload: { email: 'shopper@example.com', password: 'customer-strong-pass-2026' },
    });
    expect(custLogin.statusCode).toBe(200);
    const customerCookie = extractCookiePair(custLogin.headers['set-cookie'], 'sid_customer');

    expect(
      (await app.inject({ method: 'GET', url: '/admin/me', headers: { cookie: customerCookie } }))
        .statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: '/me', headers: { cookie: admin.cookie } }))
        .statusCode,
    ).toBe(401);

    // Staff list contract check
    const staffListRes = await app.inject({
      method: 'GET',
      url: '/admin/staff',
      headers: { cookie: admin.cookie },
    });
    expect(adminStaffListResponseSchema.parse(staffListRes.json()).items).toHaveLength(3);
  });
});
