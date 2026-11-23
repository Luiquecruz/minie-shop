import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { outbox } from '../database/schema/index.js';
import { CatalogService } from '../modules/catalog/index.js';
import { MediaService, S3StorageAdapter } from '../modules/media/index.js';
import { OutboxService } from '../modules/platform/index.js';
import {
  DeterministicFakeEmbeddingProvider,
  EmbeddingsOutboxHandler,
} from '../modules/search/index.js';
import { OutboxWorkerRunner } from '../worker/worker.runner.js';
import { createCategory } from './factories.js';
import {
  ensureTestDatabaseReady,
  getTestDatabaseUrl,
  truncateCatalogAndMedia,
} from './integration-db.js';

describe('S06 — Embeddings Pipeline & pgvector Persistence (real Postgres app_test)', () => {
  let databaseService: DatabaseService;
  let outboxService: OutboxService;
  let catalogService: CatalogService;
  let fakeProvider: DeterministicFakeEmbeddingProvider;
  let embeddingsHandler: EmbeddingsOutboxHandler;
  let runner: OutboxWorkerRunner;

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
    const storage = new S3StorageAdapter();
    const mediaService = new MediaService(databaseService, storage);
    catalogService = new CatalogService(databaseService, mediaService, outboxService);
    fakeProvider = new DeterministicFakeEmbeddingProvider({
      modelName: 'fake-embeddinggemma',
      dimensions: 768,
    });
    embeddingsHandler = new EmbeddingsOutboxHandler(
      databaseService,
      catalogService,
      outboxService,
      fakeProvider,
    );

    runner = new OutboxWorkerRunner({
      outboxService,
      logger: pino({ level: 'silent' }),
      handlers: {
        embeddings: async (event) => {
          await embeddingsHandler.handle(event);
        },
      },
    });
  });

  beforeEach(async () => {
    await truncateCatalogAndMedia(databaseService.db);
    fakeProvider.callCount = 0;
  });

  afterAll(async () => {
    await databaseService.onModuleDestroy();
  });

  it('generates vector on create, skips unchanged re-runs, regenerates on description edit, and cascades on delete', async () => {
    const cat = await createCategory(databaseService.db, { slug: 'cafe', name: 'Café' });

    const created = await catalogService.createProduct({
      categoryId: cat.id,
      slug: 'prensa-inox',
      sku: 'SKU-EMB-1',
      name: 'Prensa Francesa Inox',
      description: 'Cafeteira manual de aço inox 600ml',
      regularPriceCents: 18990,
      inStock: true,
    });

    // 1. Process initial product.changed -> generates 768d vector & enqueues search-index
    await runner.processNextBatch();
    expect(fakeProvider.callCount).toBe(1);

    const saved = await catalogService.getProductEmbeddingsByIds([created.id]);
    const firstVector = saved.get(created.id);
    expect(firstVector).toBeDefined();
    expect(firstVector?.embedding).toHaveLength(768);
    expect(firstVector?.model).toBe('fake-embeddinggemma');

    const searchIndexEvents = await databaseService.db
      .select()
      .from(outbox)
      .where(eq(outbox.consumer, 'search-index'));
    expect(searchIndexEvents.length).toBeGreaterThanOrEqual(2); // initial + post-embedding

    // 2. Re-enqueue product.changed WITHOUT changing content -> must NOT call model
    await outboxService.enqueue(databaseService.db, {
      eventType: 'product.changed',
      aggregateType: 'product',
      aggregateId: created.id,
      payload: { productId: created.id },
      consumers: ['embeddings'],
    });
    await runner.processNextBatch();
    expect(fakeProvider.callCount).toBe(1);

    // 3. Edit description -> hash changes -> regenerates vector
    await catalogService.updateProduct(created.id, {
      description: 'Cafeteira manual premium de parede dupla para café especial',
    });
    await runner.processNextBatch();
    expect(fakeProvider.callCount).toBe(2);

    const updated = (await catalogService.getProductEmbeddingsByIds([created.id])).get(created.id);
    expect(updated?.contentHash).not.toBe(firstVector?.contentHash);

    // 4. Delete product -> ON DELETE CASCADE removes vector from catalog.product_embeddings
    await catalogService.deleteProduct(created.id);
    const afterDelete = await catalogService.getProductEmbeddingMeta(created.id);
    expect(afterDelete).toBeNull();
  });
});
