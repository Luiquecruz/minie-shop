import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { sql } from 'drizzle-orm';
import {
  addressListResponseSchema,
  addressResponseSchema,
  apiErrorResponseSchema,
  authCustomerResponseSchema,
  csrfTokenResponseSchema,
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

describe('I05 — Customer Profile, Addresses Validation, Default Uniqueness & IDOR Ownership', () => {
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
      sql`TRUNCATE TABLE "identity"."customer_addresses", "identity"."sessions", "identity"."customers" RESTART IDENTITY CASCADE`,
    );
  });

  async function createAndLoginCustomer(email: string, fullName: string) {
    const hash = await passwordService.hash('minha-senha-valida-2026', {
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
    await dbService.db.insert(customers).values({
      email,
      passwordHash: hash,
      fullName,
      emailVerifiedAt: new Date(),
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN },
      payload: { email, password: 'minha-senha-valida-2026' },
    });
    const cookie = extractCookiePair(loginRes.headers['set-cookie'], 'sid_customer');
    const csrf = csrfTokenResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/auth/csrf', headers: { cookie } })).json(),
    ).csrfToken;
    return { cookie, csrf };
  }

  it('updates profile (fullName & normalized phone) and rejects email mutation', async () => {
    const alice = await createAndLoginCustomer('alice@example.com', 'Alice');

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { origin: ORIGIN, cookie: alice.cookie, 'x-csrf-token': alice.csrf },
      payload: { fullName: 'Alice Oliveira', phone: '(11) 98765-4321' },
    });
    expect(patchRes.statusCode).toBe(200);
    const updated = authCustomerResponseSchema.parse(patchRes.json());
    expect(updated.customer.fullName).toBe('Alice Oliveira');
    expect(updated.customer.phone).toBe('+5511987654321');

    // Trying to change email -> rejected by strict schema
    const emailAttempt = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { origin: ORIGIN, cookie: alice.cookie, 'x-csrf-token': alice.csrf },
      payload: { email: 'hacked@example.com' },
    });
    expect(emailAttempt.statusCode).toBe(400);
    expect(apiErrorResponseSchema.parse(emailAttempt.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('enforces CEP/UF/phone validation, unique default address, max 10 limit, and 404 ownership isolation (IDOR)', async () => {
    const alice = await createAndLoginCustomer('alice@example.com', 'Alice');
    const bob = await createAndLoginCustomer('bob@example.com', 'Bob');

    const validAddress = {
      label: 'Casa',
      recipientName: 'Alice Oliveira',
      phone: '(11) 98765-4321',
      postalCode: '01310-100',
      street: 'Avenida Paulista',
      number: '1000',
      complement: 'Apto 42',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'sp',
      country: 'BR',
    };

    // Invalid CEP, UF, phone -> 400
    for (const badPayload of [
      { ...validAddress, postalCode: '1234' },
      { ...validAddress, state: 'XX' },
      { ...validAddress, phone: '12345' },
    ]) {
      const badRes = await app.inject({
        method: 'POST',
        url: '/me/addresses',
        headers: { origin: ORIGIN, cookie: alice.cookie, 'x-csrf-token': alice.csrf },
        payload: badPayload,
      });
      expect(badRes.statusCode).toBe(400);
    }

    // First address automatically becomes default with normalized CEP/UF/phone
    const a1Res = await app.inject({
      method: 'POST',
      url: '/me/addresses',
      headers: { origin: ORIGIN, cookie: alice.cookie, 'x-csrf-token': alice.csrf },
      payload: validAddress,
    });
    expect(a1Res.statusCode).toBe(201);
    const a1 = addressResponseSchema.parse(a1Res.json()).address;
    expect(a1.postalCode).toBe('01310100');
    expect(a1.state).toBe('SP');
    expect(a1.phone).toBe('+5511987654321');
    expect(a1.isDefault).toBe(true);

    // Second address with isDefault: true flips a1.isDefault to false
    const a2Res = await app.inject({
      method: 'POST',
      url: '/me/addresses',
      headers: { origin: ORIGIN, cookie: alice.cookie, 'x-csrf-token': alice.csrf },
      payload: { ...validAddress, label: 'Trabalho', number: '2000', isDefault: true },
    });
    expect(a2Res.statusCode).toBe(201);
    const a2 = addressResponseSchema.parse(a2Res.json()).address;
    expect(a2.isDefault).toBe(true);

    const listRes = await app.inject({
      method: 'GET',
      url: '/me/addresses',
      headers: { cookie: alice.cookie },
    });
    const items = addressListResponseSchema.parse(listRes.json()).items;
    expect(items.filter((i) => i.isDefault)).toHaveLength(1);
    expect(items.find((i) => i.id === a2.id)?.isDefault).toBe(true);
    expect(items.find((i) => i.id === a1.id)?.isDefault).toBe(false);

    // IDOR: Bob CANNOT read, update, or delete Alice's address -> 404 NOT_FOUND (not 403!)
    const bobGet = await app.inject({
      method: 'GET',
      url: `/me/addresses/${a1.id}`,
      headers: { cookie: bob.cookie },
    });
    expect(bobGet.statusCode).toBe(404);
    expect(apiErrorResponseSchema.parse(bobGet.json()).error.code).toBe('NOT_FOUND');

    const bobPatch = await app.inject({
      method: 'PATCH',
      url: `/me/addresses/${a1.id}`,
      headers: { origin: ORIGIN, cookie: bob.cookie, 'x-csrf-token': bob.csrf },
      payload: { number: '9999' },
    });
    expect(bobPatch.statusCode).toBe(404);

    const bobDelete = await app.inject({
      method: 'DELETE',
      url: `/me/addresses/${a1.id}`,
      headers: { origin: ORIGIN, cookie: bob.cookie, 'x-csrf-token': bob.csrf },
    });
    expect(bobDelete.statusCode).toBe(404);

    // Create 8 more addresses (total 10), then 11th must fail with 400
    for (let i = 3; i <= 10; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/me/addresses',
        headers: { origin: ORIGIN, cookie: alice.cookie, 'x-csrf-token': alice.csrf },
        payload: { ...validAddress, label: `Addr ${i}`, number: String(i) },
      });
      expect(res.statusCode).toBe(201);
    }

    const eleventh = await app.inject({
      method: 'POST',
      url: '/me/addresses',
      headers: { origin: ORIGIN, cookie: alice.cookie, 'x-csrf-token': alice.csrf },
      payload: { ...validAddress, label: 'Overflow', number: '11' },
    });
    expect(eleventh.statusCode).toBe(400);
    expect(apiErrorResponseSchema.parse(eleventh.json()).error.code).toBe('VALIDATION_ERROR');

    // Deleting the default address promotes another address cleanly
    const delDefault = await app.inject({
      method: 'DELETE',
      url: `/me/addresses/${a2.id}`,
      headers: { origin: ORIGIN, cookie: alice.cookie, 'x-csrf-token': alice.csrf },
    });
    expect(delDefault.statusCode).toBe(204);

    const afterDel = addressListResponseSchema.parse(
      (await app.inject({ method: 'GET', url: '/me/addresses', headers: { cookie: alice.cookie } })).json(),
    ).items;
    expect(afterDel).toHaveLength(9);
    expect(afterDel.filter((i) => i.isDefault)).toHaveLength(1);
  });
});
