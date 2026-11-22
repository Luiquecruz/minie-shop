import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { CatalogService, CategoryChangedOutboxHandler } from '../modules/catalog/index.js';
import { MediaService, S3StorageAdapter } from '../modules/media/index.js';
import { OutboxService } from '../modules/platform/index.js';
import {
  SearchIndexOutboxHandler,
  type IndexableDocumentWithVectors,
  type SearchPort,
} from '../modules/search/index.js';
import { OutboxWorkerRunner } from '../worker/worker.runner.js';
import { createCategory } from './factories.js';
import {
  ensureTestDatabaseReady,
  getTestDatabaseUrl,
  truncateCatalogAndMedia,
} from './integration-db.js';

class InMemorySearchPort implements SearchPort {
  public readonly docs = new Map<string, IndexableDocumentWithVectors>();
  public failNext = false;

  async search() {
    if (this.failNext) throw new Error('Search engine offline');
    return { ids: Array.from(this.docs.keys()), estimatedTotal: this.docs.size };
  }

  async suggest() {
    if (this.failNext) throw new Error('Search engine offline');
    return [];
  }

  async upsertDocuments(docs: IndexableDocumentWithVectors[]): Promise<void> {
    if (this.failNext) {
      throw new Error('Search engine unavailable');
    }
    for (const doc of docs) {
      this.docs.set(doc.id, doc);
    }
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    if (this.failNext) {
      throw new Error('Search engine unavailable');
    }
    for (const id of ids) {
      this.docs.delete(id);
    }
  }

  async reindex(batchIterator: AsyncIterable<IndexableDocumentWithVectors[]>) {
    this.docs.clear();
    let indexedCount = 0;
    for await (const batch of batchIterator) {
      for (const doc of batch) {
        this.docs.set(doc.id, doc);
        indexedCount++;
      }
    }
    return { indexedCount, tempIndexUid: 'tmp', targetIndexUid: 'products' };
  }

  async getDocumentIds(): Promise<string[]> {
    return Array.from(this.docs.keys());
  }

  async health(): Promise<boolean> {
    return !this.failNext;
  }
}

describe('S05 — Event-Driven Search Indexing via Transactional Outbox', () => {
  let databaseService: DatabaseService;
  let outboxService: OutboxService;
  let catalogService: CatalogService;
  let searchPort: InMemorySearchPort;
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
    searchPort = new InMemorySearchPort();

    const searchIndexHandler = new SearchIndexOutboxHandler(catalogService, searchPort);
    const categoryHandler = new CategoryChangedOutboxHandler(
      databaseService,
      catalogService,
      outboxService,
    );

    runner = new OutboxWorkerRunner({
      outboxService,
      logger: pino({ level: 'silent' }),
      maxAttempts: 5,
      baseBackoffMs: 1,
      handlers: {
        'search-index': (event) => searchIndexHandler.handle(event),
        'catalog-category-fanout': (event) => categoryHandler.handle(event),
      },
    });
  });

  beforeEach(async () => {
    await truncateCatalogAndMedia(databaseService.db);
    searchPort.docs.clear();
    searchPort.failNext = false;
  });

  afterAll(async () => {
    await databaseService.onModuleDestroy();
  });

  it('indexes on create/update, removes on unpublish/delete, and propagates category renames', async () => {
    const cat = await createCategory(databaseService.db, {
      slug: 'audio',
      name: 'Áudio',
    });

    const created = await catalogService.createProduct({
      categoryId: cat.id,
      slug: 'fone-studio',
      sku: 'SKU-S05-1',
      name: 'Fone Studio',
      description: 'Fone de referência',
      regularPriceCents: 49900,
      inStock: true,
      status: 'published',
    });

    await runner.processNextBatch();
    expect(searchPort.docs.get(created.id)?.name).toBe('Fone Studio');
    expect(searchPort.docs.get(created.id)?.categoryNames).toBe('Áudio');

    // Update product name and stock
    await catalogService.updateProduct(created.id, { name: 'Fone Studio MK2', inStock: false });
    await runner.processNextBatch();
    expect(searchPort.docs.get(created.id)?.name).toBe('Fone Studio MK2');
    expect(searchPort.docs.get(created.id)?.inStock).toBe(false);

    // Rename category -> category.changed -> catalog-category-fanout -> product.changed -> search-index
    await catalogService.updateCategory(cat.id, { name: 'Áudio Profissional' });
    await runner.processNextBatch(); // processes category.changed
    await runner.processNextBatch(); // processes fanned-out product.changed
    expect(searchPort.docs.get(created.id)?.categoryNames).toBe('Áudio Profissional');

    // Unpublish -> deleted from index
    await catalogService.setProductStatus(created.id, 'draft');
    await runner.processNextBatch();
    expect(searchPort.docs.has(created.id)).toBe(false);

    // Republish -> re-indexed; then delete -> removed again
    await catalogService.setProductStatus(created.id, 'published');
    await runner.processNextBatch();
    expect(searchPort.docs.has(created.id)).toBe(true);

    await catalogService.deleteProduct(created.id);
    await runner.processNextBatch();
    expect(searchPort.docs.has(created.id)).toBe(false);
  });

  it('accumulates events while search engine is down and applies them when it recovers', async () => {
    const cat = await createCategory(databaseService.db, { slug: 'resilience', name: 'Resiliência' });

    searchPort.failNext = true;

    const p1 = await catalogService.createProduct({
      categoryId: cat.id,
      slug: 'teclado-pro',
      sku: 'SKU-S05-OUTAGE',
      name: 'Teclado Pro',
      description: 'Teclado mecânico',
      regularPriceCents: 35000,
      inStock: true,
    });

    // Attempt while search is down -> stays pending in outbox, index remains empty
    await runner.processNextBatch();
    expect(searchPort.docs.has(p1.id)).toBe(false);
    expect(await outboxService.countPending(['search-index'])).toBe(1);

    // Engine comes back online -> wait tiny backoff -> worker applies event
    searchPort.failNext = false;
    await new Promise((r) => setTimeout(r, 20));
    await runner.processNextBatch();

    expect(searchPort.docs.get(p1.id)?.name).toBe('Teclado Pro');
    expect(await outboxService.countPending(['search-index'])).toBe(0);
  });
});
