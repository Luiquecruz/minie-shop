import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { sql } from 'drizzle-orm';
import { createApp } from '../app.factory.js';
import { loadEnv, resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { MailerOutboxHandler } from '../modules/identity/index.js';
import { OutboxService } from '../modules/platform/index.js';
import { OutboxWorkerRunner } from '../worker/worker.runner.js';
import { ensureTestDatabaseReady, getTestDatabaseUrl } from './integration-db.js';

const RUN_E2E = process.env.RUN_MAILPIT_E2E === 'true';
const ORIGIN = 'http://localhost:5199';
const MAILPIT_API = process.env.MAILPIT_API_URL ?? 'http://127.0.0.1:8025';

describe.skipIf(!RUN_E2E)('I03 E2E — Real Mailpit SMTP Delivery & Verification Flow', () => {
  const testDbUrl = getTestDatabaseUrl();
  let app: NestFastifyApplication;
  let dbService: DatabaseService;
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
    process.env.MAIL_TRANSPORT = 'smtp';
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = '1025';
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

    await fetch(`${MAILPIT_API}/api/v1/messages`, { method: 'DELETE' });
    await dbService.db.execute(
      sql`TRUNCATE TABLE "identity"."sessions", "identity"."email_tokens", "identity"."customers", "platform"."outbox" RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await app.close();
    resetEnvCache();
  });

  it('delivers HTML + text verification email to Mailpit, extracts link token, verifies account and logs in', async () => {
    const email = `e2e-mailpit-${Date.now()}@example.com`;
    const password = 'senha-e2e-mailpit-segura-2026';

    const regRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { origin: ORIGIN },
      payload: { email, password, fullName: 'Cliente Mailpit E2E' },
    });
    expect(regRes.statusCode).toBe(202);

    // Drain mailer outbox -> sends via real SMTP to Mailpit
    const processed = await runner.processNextBatch();
    expect(processed).toBeGreaterThanOrEqual(1);

    // Fetch messages from Mailpit REST API
    const listRes = await fetch(`${MAILPIT_API}/api/v1/messages`);
    expect(listRes.ok).toBe(true);
    const listJson = (await listRes.json()) as {
      messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
    };
    const msgSummary = listJson.messages.find((m) =>
      m.To.some((to) => to.Address.toLowerCase() === email.toLowerCase()),
    );
    expect(msgSummary).toBeDefined();

    const detailRes = await fetch(`${MAILPIT_API}/api/v1/message/${msgSummary!.ID}`);
    expect(detailRes.ok).toBe(true);
    const detail = (await detailRes.json()) as { HTML: string; Text: string; Subject: string };
    expect(detail.Subject).toContain('Confirme seu e-mail');
    expect(detail.HTML).toContain('Cliente Mailpit E2E');
    expect(detail.Text).toContain('Cliente Mailpit E2E');

    const match = detail.Text.match(/\/verify-email\?token=([^\s"&<]+)/);
    expect(match?.[1]).toBeDefined();
    const token = decodeURIComponent(match![1]!);

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      headers: { origin: ORIGIN },
      payload: { token },
    });
    expect(verifyRes.statusCode).toBe(200);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ORIGIN },
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);
  });
});
