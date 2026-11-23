import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { sql } from 'drizzle-orm';
import {
  csrfTokenResponseSchema,
  favoritesListResponseSchema,
} from '@minieshop/contracts';
import { createApp } from '../app.factory.js';
import { loadEnv, resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { customers } from '../database/schema/index.js';
import {
  PasswordService,
  RATE_LIMITER_TOKEN,
  type RateLimiter,
} from '../modules/identity/index.js';
import { createCategory, createProduct } from './factories.js';
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

describe('I06 — Anonymous Favorites Merge on Login & Customer Isolation', () => {
  const testDbUrl = getTestDatabaseUrl();
  let app: NestFastifyApplication;
  let dbService: DatabaseService;
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
      sql`TRUNCATE TABLE "catalog"."favorites", "catalog"."products", "catalog"."categories", "identity"."sessions", "identity"."customers" RESTART IDENTITY CASCADE`,
    );
  });

  it('merges anonymous favorites on login without duplicates, clears anon_id, is idempotent on re-login, and isolates Customer A vs B', async () => {
    const cat = await createCategory(dbService.db, { slug: 'audio', name: 'Audio' });
    const p1 = await createProduct(dbService.db, { categoryId: cat.id, slug: 'fone-1' });
    const p2 = await createProduct(dbService.db, { categoryId: cat.id, slug: 'fone-2' });
    const p3 = await createProduct(dbService.db, { categoryId: cat.id, slug: 'fone-3' });

    const hash = await passwordService.hash('minha-senha-valida-2026', {
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
    await dbService.db.insert(customers).values([
      { email: 'alice@example.com', passwordHash: hash, fullName: 'Alice', emailVerifiedAt: new Date() },
      { email: 'bob@example.com', passwordHash: hash, fullName: 'Bob', emailVerifiedAt: new Date() },
    ]);

    // 1. Alice already has p1 favorited in her account
    const aliceLogin0 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN },
      payload: { email: 'alice@example.com', password: 'minha-senha-valida-2026' },
    });
    const aliceCookie0 = extractCookiePair(aliceLogin0.headers['set-cookie'], 'sid_customer');
    const aliceCsrf0 = csrfTokenResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/auth/csrf', headers: { cookie: aliceCookie0 } })).json(),
    ).csrfToken;

    // Authenticated POST /favorites requires x-csrf-token
    const missingCsrf = await app.inject({
      method: 'POST',
      url: `/favorites/${p1.id}`,
      headers: { origin: ORIGIN, cookie: aliceCookie0 },
    });
    expect(missingCsrf.statusCode).toBe(403);

    const addP1 = await app.inject({
      method: 'POST',
      url: `/favorites/${p1.id}`,
      headers: { origin: ORIGIN, cookie: aliceCookie0, 'x-csrf-token': aliceCsrf0 },
    });
    expect(addP1.statusCode).toBe(200);

    // 2. Anonymous visitor favorites p1 (overlapping!) and p2
    const anonAdd1 = await app.inject({
      method: 'POST',
      url: `/favorites/${p1.id}`,
      headers: { origin: ORIGIN },
    });
    expect(anonAdd1.statusCode).toBe(200);
    const anonCookie = extractCookiePair(anonAdd1.headers['set-cookie'], 'anon_id');

    const anonAdd2 = await app.inject({
      method: 'POST',
      url: `/favorites/${p2.id}`,
      headers: { origin: ORIGIN, cookie: anonCookie },
    });
    expect(anonAdd2.statusCode).toBe(200);

    // 3. Alice logs in carrying anon_id -> merges p1 (no duplicate!) & p2, clears anon_id
    const aliceLogin1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN, cookie: anonCookie },
      payload: { email: 'alice@example.com', password: 'minha-senha-valida-2026' },
    });
    expect(aliceLogin1.statusCode).toBe(200);
    const setCookies = Array.isArray(aliceLogin1.headers['set-cookie'])
      ? aliceLogin1.headers['set-cookie']
      : [String(aliceLogin1.headers['set-cookie'])];
    expect(setCookies.some((c) => c.startsWith('anon_id=;') || c.includes('Max-Age=0'))).toBe(true);
    const aliceCookie1 = extractCookiePair(aliceLogin1.headers['set-cookie'], 'sid_customer');

    const aliceFavs = favoritesListResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/favorites', headers: { cookie: aliceCookie1 } })).json(),
    );
    expect(aliceFavs.productIds.sort()).toEqual([p1.id, p2.id].sort());

    // 4. Re-login with old anonCookie is idempotent (no duplicates, anon rows already removed)
    const aliceLogin2 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN, cookie: anonCookie },
      payload: { email: 'alice@example.com', password: 'minha-senha-valida-2026' },
    });
    const aliceCookie2 = extractCookiePair(aliceLogin2.headers['set-cookie'], 'sid_customer');
    const aliceFavs2 = favoritesListResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/favorites', headers: { cookie: aliceCookie2 } })).json(),
    );
    expect(aliceFavs2.productIds.sort()).toEqual([p1.id, p2.id].sort());

    // 5. Logout does NOT restore anonymous favorites
    const aliceCsrf2 = csrfTokenResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/auth/csrf', headers: { cookie: aliceCookie2 } })).json(),
    ).csrfToken;
    await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { origin: ORIGIN, cookie: aliceCookie2, 'x-csrf-token': aliceCsrf2 },
    });
    const afterLogoutAnon = favoritesListResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/favorites', headers: { cookie: anonCookie } })).json(),
    );
    expect(afterLogoutAnon.productIds).toEqual([]);

    // 6. Customer B (Bob) never sees Alice's favorites
    const bobLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN },
      payload: { email: 'bob@example.com', password: 'minha-senha-valida-2026' },
    });
    const bobCookie = extractCookiePair(bobLogin.headers['set-cookie'], 'sid_customer');
    const bobCsrf = csrfTokenResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/auth/csrf', headers: { cookie: bobCookie } })).json(),
    ).csrfToken;
    await app.inject({
      method: 'POST',
      url: `/favorites/${p3.id}`,
      headers: { origin: ORIGIN, cookie: bobCookie, 'x-csrf-token': bobCsrf },
    });

    const bobFavs = favoritesListResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/favorites', headers: { cookie: bobCookie } })).json(),
    );
    expect(bobFavs.productIds).toEqual([p3.id]);
  });
});
