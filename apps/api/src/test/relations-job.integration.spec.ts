import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { categoryComplements, productRelations } from '../database/schema/index.js';
import { CatalogService } from '../modules/catalog/index.js';
import { MediaService, S3StorageAdapter } from '../modules/media/index.js';
import { OutboxService } from '../modules/platform/index.js';
import {
  RecommendationsOutboxHandler,
  RelationsService,
} from '../modules/recommendations/index.js';
import {
  EmbeddingsOutboxHandler,
  type EmbeddingProvider,
} from '../modules/search/index.js';
import { OutboxWorkerRunner } from '../worker/worker.runner.js';
import { createCategory, createProduct } from './factories.js';
import {
  ensureTestDatabaseReady,
  getTestDatabaseUrl,
  truncateCatalogAndMedia,
} from './integration-db.js';

function makeNormalizedVector(seed: number, dimensions = 768): number[] {
  const vec = new Array<number>(dimensions).fill(0);
  // Place signal in the first few dimensions for controllable cosine similarity
  vec[0] = Math.cos(seed);
  vec[1] = Math.sin(seed);
  vec[2] = 0.25;
  const norm = Math.hypot(vec[0]!, vec[1]!, vec[2]!);
  vec[0] = vec[0]! / norm;
  vec[1] = vec[1]! / norm;
  vec[2] = vec[2]! / norm;
  return vec;
}

describe('R03 — Relations Job, Outbox Handlers, Manual Override & Rule/Vector Modes', () => {
  let databaseService: DatabaseService;
  let outboxService: OutboxService;
  let catalogService: CatalogService;
  let relationsService: RelationsService;
  let embeddingsHandler: EmbeddingsOutboxHandler;
  let recommendationsHandler: RecommendationsOutboxHandler;
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
    relationsService = new RelationsService(databaseService, catalogService, outboxService);

    const syntheticProvider: EmbeddingProvider = {
      modelName: 'fake-embeddinggemma',
      dimensions: 768,
      async embedDocuments(docs) {
        return docs.map((d) => {
          if (d.title.includes('Studio')) return makeNormalizedVector(0.15);
          if (d.title.includes('Smartwatch')) return makeNormalizedVector(0.25);
          return makeNormalizedVector(0.1);
        });
      },
      async embedQuery() {
        return makeNormalizedVector(0.1);
      },
    };
    embeddingsHandler = new EmbeddingsOutboxHandler(
      databaseService,
      catalogService,
      outboxService,
      syntheticProvider,
    );
    recommendationsHandler = new RecommendationsOutboxHandler(relationsService);

    runner = new OutboxWorkerRunner({
      outboxService,
      logger: pino({ level: 'silent' }),
      handlers: {
        embeddings: async (event) => {
          await embeddingsHandler.handle(event);
        },
        recommendations: async (event) => {
          await recommendationsHandler.handle(event);
        },
        'search-index': async () => {
          // No-op in this suite
        },
      },
    });
  });

  beforeEach(async () => {
    await truncateCatalogAndMedia(databaseService.db);
  });

  afterAll(async () => {
    await databaseService.onModuleDestroy();
  });

  it('computes rule fallback without vectors, protects manual curation, is idempotent, and excludes unpublished/self', async () => {
    const rootElec = await createCategory(databaseService.db, { slug: 'eletronicos' });
    const audio = await createCategory(databaseService.db, {
      slug: 'audio',
      parentId: rootElec.id,
    });
    const bags = await createCategory(databaseService.db, { slug: 'bolsas-e-mochilas' });

    await databaseService.db.insert(categoryComplements).values({
      categoryId: audio.id,
      complementCategoryId: bags.id,
      position: 0,
    });

    const pBase = await createProduct(databaseService.db, {
      categoryId: audio.id,
      slug: 'earbuds-base',
      regularPriceCents: 20000,
    });
    const pHigher = await createProduct(databaseService.db, {
      categoryId: audio.id,
      slug: 'fone-pro',
      regularPriceCents: 32000, // 1.6x -> valid upsell
    });
    const pDraft = await createProduct(databaseService.db, {
      categoryId: audio.id,
      slug: 'fone-draft',
      regularPriceCents: 25000,
      status: 'draft',
    });
    const pBag = await createProduct(databaseService.db, {
      categoryId: bags.id,
      slug: 'mochila-tech',
      regularPriceCents: 19000,
    });

    // Add manual curation before auto recompute
    await relationsService.addManualRelation({
      productSlug: pBase.slug,
      relatedProductSlug: pBag.slug,
      type: 'related',
      position: 0,
    });

    const first = await relationsService.recompute(pBase.id, { cascade: false });
    expect(first.recomputed).toBe(true);
    expect(first.method).toBe('rule');
    expect(first.counts.upsell).toBe(1);
    expect(first.counts.cross_sell).toBe(1);

    const rowsAfterFirst = await databaseService.db
      .select()
      .from(productRelations)
      .where(eq(productRelations.productId, pBase.id));

    // No self-relation and no draft product
    expect(rowsAfterFirst.some((r) => r.relatedProductId === pBase.id)).toBe(false);
    expect(rowsAfterFirst.some((r) => r.relatedProductId === pDraft.id)).toBe(false);

    // Manual relation preserved untouched
    const manualRow = rowsAfterFirst.find(
      (r) => r.relatedProductId === pBag.id && r.type === 'related',
    );
    expect(manualRow?.source).toBe('manual');
    expect(manualRow?.method).toBe('manual');
    expect(manualRow?.score).toBeNull();

    // Upsell points to pHigher
    const upsellRow = rowsAfterFirst.find((r) => r.type === 'upsell');
    expect(upsellRow?.relatedProductId).toBe(pHigher.id);
    expect(upsellRow?.method).toBe('rule');

    // Re-running recompute is strictly idempotent
    await relationsService.recompute(pBase.id, { cascade: false });
    const rowsAfterSecond = await databaseService.db
      .select()
      .from(productRelations)
      .where(eq(productRelations.productId, pBase.id));

    expect(rowsAfterSecond.length).toBe(rowsAfterFirst.length);
    const manualAfterSecond = rowsAfterSecond.find(
      (r) => r.relatedProductId === pBag.id && r.type === 'related',
    );
    expect(manualAfterSecond?.id).toBe(manualRow?.id);
    expect(manualAfterSecond?.source).toBe('manual');
  });

  it('recomputes via vector mode with hnsw.iterative_scan and reacts to product.changed + product.embedding_updated', async () => {
    const rootElec = await createCategory(databaseService.db, { slug: 'eletronicos-v' });
    const catAudio = await createCategory(databaseService.db, {
      slug: 'audio-v',
      parentId: rootElec.id,
    });
    const catWearables = await createCategory(databaseService.db, {
      slug: 'wearables-v',
      parentId: rootElec.id,
    });

    const p1 = await catalogService.createProduct({
      categoryId: catAudio.id,
      slug: 'audio-1',
      sku: 'SKU-R03-1',
      name: 'Fone Base',
      description: 'Fone bluetooth confortável',
      regularPriceCents: 20000,
      inStock: true,
    });
    const p2 = await catalogService.createProduct({
      categoryId: catAudio.id,
      slug: 'audio-2',
      sku: 'SKU-R03-2',
      name: 'Fone Studio Pro',
      description: 'Fone bluetooth profissional com cancelamento de ruído',
      regularPriceCents: 30000,
      inStock: true,
    });
    const p3 = await catalogService.createProduct({
      categoryId: catWearables.id,
      slug: 'wearable-1',
      sku: 'SKU-R03-3',
      name: 'Smartwatch Active',
      description: 'Relógio inteligente esportivo',
      regularPriceCents: 25000,
      inStock: true,
    });

    // Save synthetic embeddings directly via CatalogService public interface
    await catalogService.upsertProductEmbedding({
      productId: p1.id,
      embedding: makeNormalizedVector(0.1),
      model: 'fake-embeddinggemma',
      contentHash: 'h1',
    });
    await catalogService.upsertProductEmbedding({
      productId: p2.id,
      embedding: makeNormalizedVector(0.15), // very close to p1
      model: 'fake-embeddinggemma',
      contentHash: 'h2',
    });
    await catalogService.upsertProductEmbedding({
      productId: p3.id,
      embedding: makeNormalizedVector(0.25), // sibling, still above 0.45
      model: 'fake-embeddinggemma',
      contentHash: 'h3',
    });

    // Drain initial outbox events (product.changed -> recommendations + embeddings -> product.embedding_updated)
    for (let i = 0; i < 6; i++) {
      await runner.processNextBatch();
    }

    const p1Relations = await databaseService.db
      .select()
      .from(productRelations)
      .where(and(eq(productRelations.productId, p1.id), eq(productRelations.type, 'related')));

    expect(p1Relations.length).toBeGreaterThanOrEqual(1);
    expect(p1Relations.every((r) => r.method === 'vector')).toBe(true);

    // Edit category of p1 -> product.changed triggers recompute
    await catalogService.updateProduct(p1.id, { categoryId: catWearables.id });
    for (let i = 0; i < 6; i++) {
      await runner.processNextBatch();
    }

    // Now p1 is in catWearables, so upsell (same leaf) should look at catWearables (p3 = 25000 = 1.25x)
    const p1Upsells = await databaseService.db
      .select()
      .from(productRelations)
      .where(and(eq(productRelations.productId, p1.id), eq(productRelations.type, 'upsell')));

    expect(p1Upsells.some((r) => r.relatedProductId === p3.id)).toBe(true);
    expect(await outboxService.countPending(['recommendations'])).toBe(0);
  });

  it('enforces cross-sell diversity cap per complementary category and prevents duplicate triples', async () => {
    const srcCat = await createCategory(databaseService.db, { slug: 'src-div' });
    const compA = await createCategory(databaseService.db, { slug: 'comp-a' });
    const compB = await createCategory(databaseService.db, { slug: 'comp-b' });

    await databaseService.db.insert(categoryComplements).values([
      { categoryId: srcCat.id, complementCategoryId: compA.id, position: 0 },
      { categoryId: srcCat.id, complementCategoryId: compB.id, position: 1 },
    ]);

    const pSrc = await createProduct(databaseService.db, {
      categoryId: srcCat.id,
      slug: 'src-item',
      regularPriceCents: 10000,
    });
    // 4 items in compA, 2 items in compB -> default maxPerCategory=2 should take at most 2 from compA + 2 from compB
    const compAIds: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const p = await createProduct(databaseService.db, {
        categoryId: compA.id,
        slug: `comp-a-${i}`,
        regularPriceCents: 10000 + i * 100,
      });
      compAIds.push(p.id);
    }
    const compBIds: string[] = [];
    for (let i = 1; i <= 2; i++) {
      const p = await createProduct(databaseService.db, {
        categoryId: compB.id,
        slug: `comp-b-${i}`,
        regularPriceCents: 10000 + i * 100,
      });
      compBIds.push(p.id);
    }

    await relationsService.recompute(pSrc.id, { cascade: false });

    const crossRows = await databaseService.db
      .select()
      .from(productRelations)
      .where(and(eq(productRelations.productId, pSrc.id), eq(productRelations.type, 'cross_sell')));

    const fromA = crossRows.filter((r) => compAIds.includes(r.relatedProductId));
    const fromB = crossRows.filter((r) => compBIds.includes(r.relatedProductId));

    expect(fromA.length).toBeLessThanOrEqual(2);
    expect(fromB.length).toBe(2);
    expect(new Set(crossRows.map((r) => r.relatedProductId)).size).toBe(crossRows.length);
  });
});
