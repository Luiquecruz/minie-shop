import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { outbox } from '../database/schema/index.js';
import { OutboxService } from '../modules/platform/index.js';
import { OutboxWorkerRunner } from '../worker/worker.runner.js';
import {
  ensureTestDatabaseReady,
  getTestDatabaseUrl,
  truncateCatalogAndMedia,
} from './integration-db.js';

describe('S03 — Transactional Outbox & Worker Runner (real Postgres app_test)', () => {
  let databaseService: DatabaseService;
  let outboxService: OutboxService;
  const silentLogger = pino({ level: 'silent' });

  beforeAll(async () => {
    resetEnvCache();
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = getTestDatabaseUrl();
    process.env.S3_ENDPOINT ??= 'http://localhost:8333';
    process.env.S3_PUBLIC_ENDPOINT ??= 'http://localhost:8333';
    process.env.S3_ACCESS_KEY_ID ??= 'minieshop_dev_access_key';
    process.env.S3_SECRET_ACCESS_KEY ??= 'minieshop_dev_secret_key';
    process.env.S3_PUBLIC_BUCKET ??= 'minieshop-catalog-public';
    process.env.S3_PRIVATE_BUCKET ??= 'minieshop-private';

    await ensureTestDatabaseReady(process.env.DATABASE_URL);
    databaseService = new DatabaseService();
    outboxService = new OutboxService(databaseService);
  });

  beforeEach(async () => {
    await truncateCatalogAndMedia(databaseService.db);
  });

  afterAll(async () => {
    await databaseService.onModuleDestroy();
  });

  it('processes an enqueued event exactly once', async () => {
    const handled: string[] = [];
    await outboxService.enqueue(databaseService.db, {
      eventType: 'outbox.ping',
      aggregateType: 'system',
      aggregateId: 'ping-1',
      payload: { id: 'ping-1' },
    });

    const runner = new OutboxWorkerRunner({
      outboxService,
      logger: silentLogger,
      handlers: {
        noop: async (event) => {
          handled.push(event.aggregateId);
        },
      },
    });

    const firstBatch = await runner.processNextBatch();
    const secondBatch = await runner.processNextBatch();

    expect(firstBatch).toBe(1);
    expect(secondBatch).toBe(0);
    expect(handled).toEqual(['ping-1']);

    const stats = await outboxService.getStats();
    expect(stats).toEqual([{ status: 'processed', consumer: 'noop', total: 1 }]);
  });

  it('ensures two concurrent workers never claim the same event (FOR UPDATE SKIP LOCKED)', async () => {
    const events = Array.from({ length: 10 }, (_, idx) => ({
      eventType: 'outbox.ping' as const,
      aggregateType: 'system' as const,
      aggregateId: `concurrent-${idx}`,
      payload: { id: `concurrent-${idx}` },
    }));
    await outboxService.enqueueBatch(databaseService.db, events);

    const processedByWorkerA: string[] = [];
    const processedByWorkerB: string[] = [];

    const workerA = new OutboxWorkerRunner({
      outboxService,
      logger: silentLogger,
      batchSize: 5,
      handlers: {
        noop: async (event) => {
          await new Promise((r) => setTimeout(r, 10));
          processedByWorkerA.push(event.id);
        },
      },
    });

    const workerB = new OutboxWorkerRunner({
      outboxService,
      logger: silentLogger,
      batchSize: 5,
      handlers: {
        noop: async (event) => {
          await new Promise((r) => setTimeout(r, 10));
          processedByWorkerB.push(event.id);
        },
      },
    });

    await Promise.all([workerA.processNextBatch(), workerB.processNextBatch()]);
    // Drain any remaining if one batch claimed fewer
    await Promise.all([workerA.processNextBatch(), workerB.processNextBatch()]);

    const combined = [...processedByWorkerA, ...processedByWorkerB];
    expect(combined).toHaveLength(10);
    expect(new Set(combined).size).toBe(10);
  });

  it('moves repeatedly failing events to dead letter and supports requeue', async () => {
    const [eventId] = await outboxService.enqueue(databaseService.db, {
      eventType: 'outbox.ping',
      aggregateType: 'system',
      aggregateId: 'will-fail',
      payload: { id: 'will-fail' },
    });

    let shouldFail = true;
    const runner = new OutboxWorkerRunner({
      outboxService,
      logger: silentLogger,
      maxAttempts: 3,
      baseBackoffMs: 1,
      handlers: {
        noop: async () => {
          if (shouldFail) {
            throw new Error('Simulated downstream outage');
          }
        },
      },
    });

    for (let i = 0; i < 3; i++) {
      await runner.processNextBatch();
      await databaseService.db
        .update(outbox)
        .set({ availableAt: new Date(Date.now() - 1000) })
        .where(eq(outbox.id, eventId!));
    }

    const [deadRow] = await databaseService.db
      .select()
      .from(outbox)
      .where(eq(outbox.id, eventId!));
    expect(deadRow?.status).toBe('dead');
    expect(deadRow?.attempts).toBe(3);
    expect(deadRow?.lastError).toContain('Simulated downstream outage');

    // Requeue --dead and succeed
    shouldFail = false;
    const requeued = await outboxService.requeue({ dead: true });
    expect(requeued).toBe(1);

    await runner.processNextBatch();
    const [recoveredRow] = await databaseService.db
      .select()
      .from(outbox)
      .where(eq(outbox.id, eventId!));
    expect(recoveredRow?.status).toBe('processed');
  });

  it('reclaims events whose lease (locked_until) has expired', async () => {
    const [eventId] = await outboxService.enqueue(databaseService.db, {
      eventType: 'outbox.ping',
      aggregateType: 'system',
      aggregateId: 'stale-lease',
      payload: { id: 'stale-lease' },
    });

    // Simulate a crashed worker that left locked_until in the past
    await databaseService.db
      .update(outbox)
      .set({
        lockedUntil: sql`now() - interval '5 seconds'`,
        attempts: 1,
      })
      .where(eq(outbox.id, eventId!));

    let reclaimed = false;
    const runner = new OutboxWorkerRunner({
      outboxService,
      logger: silentLogger,
      handlers: {
        noop: async () => {
          reclaimed = true;
        },
      },
    });

    const count = await runner.processNextBatch();
    expect(count).toBe(1);
    expect(reclaimed).toBe(true);

    const [row] = await databaseService.db.select().from(outbox).where(eq(outbox.id, eventId!));
    expect(row?.status).toBe('processed');
    expect(row?.attempts).toBe(2);
  });

  it('isolates failures per consumer so a failing consumer never blocks another consumer of the same event', async () => {
    await outboxService.enqueue(databaseService.db, {
      eventType: 'product.changed',
      aggregateType: 'product',
      aggregateId: 'prod-123',
      payload: { productId: 'prod-123' },
    });

    const searchIndexed: string[] = [];
    const runner = new OutboxWorkerRunner({
      outboxService,
      logger: silentLogger,
      maxAttempts: 2,
      baseBackoffMs: 1000,
      handlers: {
        'search-index': async (event) => {
          searchIndexed.push(event.aggregateId);
        },
        embeddings: async () => {
          throw new Error('Ollama unavailable');
        },
      },
    });

    await runner.processNextBatch();

    expect(searchIndexed).toEqual(['prod-123']);

    const rows = await databaseService.db.select().from(outbox);
    const byConsumer = new Map(rows.map((r) => [r.consumer, r]));
    expect(byConsumer.get('search-index')?.status).toBe('processed');
    expect(byConsumer.get('embeddings')?.status).toBe('pending');
    expect(byConsumer.get('embeddings')?.lastError).toContain('Ollama unavailable');
  });
});
