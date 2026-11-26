import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import {
  apiErrorResponseSchema,
  searchResponseSchema,
  searchSuggestResponseSchema,
} from '@minieshop/contracts';
import { createApp } from '../app.factory.js';
import { loadEnv, resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { products } from '../database/schema/index.js';
import { CatalogService } from '../modules/catalog/index.js';
import {
  DeterministicFakeEmbeddingProvider,
  EMBEDDING_PROVIDER,
  MeilisearchAdapter,
  SEARCH_PORT,
  SearchService,
  buildProductEmbeddingText,
} from '../modules/search/index.js';
import { createCategory, createProduct } from './factories.js';
import {
  ensureTestDatabaseReady,
  getTestDatabaseUrl,
  truncateCatalogAndMedia,
} from './integration-db.js';

const TEST_MEILI_INDEX = 'products_test_s07';

function configureSearchTestEnv(overrides: Record<string, string> = {}): void {
  resetEnvCache();
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = getTestDatabaseUrl();
  process.env.S3_ENDPOINT ??= 'http://localhost:8333';
  process.env.S3_PUBLIC_ENDPOINT ??= 'http://localhost:8333';
  process.env.S3_REGION ??= 'us-east-1';
  process.env.S3_ACCESS_KEY_ID ??= 'minieshop_dev_access_key';
  process.env.S3_SECRET_ACCESS_KEY ??= 'minieshop_dev_secret_key';
  process.env.S3_PUBLIC_BUCKET ??= 'minieshop-catalog-public';
  process.env.S3_PRIVATE_BUCKET ??= 'minieshop-private';
  process.env.MEILI_HOST ??= 'http://127.0.0.1:7700';
  process.env.MEILI_MASTER_KEY ??= 'minieshop_dev_meili_master_key_32chars';
  process.env.MEILI_API_KEY = process.env.MEILI_MASTER_KEY;
  process.env.MEILI_INDEX_PRODUCTS = TEST_MEILI_INDEX;
  process.env.EMBEDDINGS_PROVIDER = 'fake';
  process.env.EMBEDDINGS_MODEL = 'fake-embeddinggemma';
  process.env.EMBEDDINGS_DIMENSIONS = '768';
  process.env.MEILI_EMBEDDER_NAME = 'semantic';
  process.env.SEARCH_SEMANTIC_RATIO = '0.5';
  process.env.CHAOS_ENABLED = 'false';

  for (const [k, v] of Object.entries(overrides)) {
    process.env[k] = v;
  }
}

describe('S07 — Hybrid Search, Suggest, Hydration & 3-Layer Degradation (real Meilisearch + app_test)', () => {
  let app: NestFastifyApplication;
  let databaseService: DatabaseService;
  let catalogService: CatalogService;
  let searchPort: MeilisearchAdapter;
  let fakeProvider: DeterministicFakeEmbeddingProvider;
  let searchService: SearchService;

  beforeAll(async () => {
    configureSearchTestEnv();
    await ensureTestDatabaseReady(process.env.DATABASE_URL!);

    const created = await createApp({ env: loadEnv() });
    app = created.app;
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    databaseService = app.get(DatabaseService);
    catalogService = app.get(CatalogService);
    searchPort = app.get(SEARCH_PORT);
    fakeProvider = app.get(EMBEDDING_PROVIDER);
    searchService = app.get(SearchService);

    const healthy = await searchPort.health(3_000);
    expect(healthy).toBe(true);
  });

  beforeEach(async () => {
    await truncateCatalogAndMedia(databaseService.db);
    fakeProvider.callCount = 0;
    fakeProvider.shouldFail = false;
    searchService.resetRuntimeState();
  });

  afterAll(async () => {
    // Clean up dedicated test index
    await fetch(`${process.env.MEILI_HOST}/indexes/${TEST_MEILI_INDEX}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${process.env.MEILI_MASTER_KEY}` },
    }).catch(() => undefined);
    await app.close();
  });

  async function indexCurrentProducts(): Promise<void> {
    const ids = await catalogService.listAllPublishedProductIds();
    const docs = await catalogService.getIndexableProductsByIds(ids);
    const vectors = await fakeProvider.embedDocuments(
      docs.map((d) => ({ title: d.name, text: buildProductEmbeddingText(d) })),
    );
    const docsWithVectors = docs.map((d, i) => ({
      ...d,
      _vectors: {
        semantic: { embeddings: vectors[i]!, regenerate: false as const },
      },
    }));

    async function* singleBatch() {
      yield docsWithVectors;
    }

    await searchPort.reindex(singleBatch(), {
      embedderName: 'semantic',
      embedderDimensions: 768,
    });
    fakeProvider.callCount = 0;
  }

  it('serves hybrid search, keyword-only mode without embeddings, and fresh Postgres hydration', async () => {
    const db = databaseService.db;
    const root = await createCategory(db, { slug: 'eletronicos', name: 'Eletrônicos' });
    const audio = await createCategory(db, { slug: 'audio', name: 'Áudio', parentId: root.id });

    const p1 = await createProduct(db, {
      categoryId: audio.id,
      slug: 'fone-bluetooth-pro',
      name: 'Fone Bluetooth Over-Ear Pro',
      description: 'Cancelamento de ruído ativo para viagens',
      regularPriceCents: 39990,
      inStock: true,
    });
    const p2 = await createProduct(db, {
      categoryId: audio.id,
      slug: 'caixa-som-portatil',
      name: 'Caixa de Som Portátil',
      description: 'Som potente à prova de água',
      regularPriceCents: 19990,
      inStock: true,
    });

    await indexCurrentProducts();

    // 1. Hybrid mode (default) -> uses embedding provider and returns mode: 'hybrid'
    const hybridRes = await app.inject({
      method: 'GET',
      url: '/search?q=fone+bluetooth',
    });
    expect(hybridRes.statusCode).toBe(200);
    expect(hybridRes.headers['cache-control']).toBe('public, max-age=30');
    expect(hybridRes.headers['etag']).toBeTruthy();
    const hybridBody = searchResponseSchema.parse(hybridRes.json());
    expect(hybridBody.mode).toBe('hybrid');
    expect(hybridBody.items.map((i) => i.slug)).toContain('fone-bluetooth-pro');
    expect(fakeProvider.callCount).toBe(1);

    // Repeating same query hits in-memory LRU cache (no extra embedding call!)
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/search?q=fone+bluetooth',
    });
    expect(cachedRes.statusCode).toBe(200);
    expect(fakeProvider.callCount).toBe(1);

    // 2. Keyword mode -> NEVER calls embedding provider
    const kwRes = await app.inject({
      method: 'GET',
      url: '/search?q=caixa+portatil&mode=keyword',
    });
    expect(kwRes.statusCode).toBe(200);
    const kwBody = searchResponseSchema.parse(kwRes.json());
    expect(kwBody.mode).toBe('keyword');
    expect(kwBody.items[0]?.slug).toBe('caixa-som-portatil');
    expect(fakeProvider.callCount).toBe(1);

    // 3. Hydration freshness: update price and unpublish p2 directly in Postgres (index stays stale!)
    await db
      .update(products)
      .set({ specialPriceCents: 29990 })
      .where(eq(products.id, p1.id));
    await db
      .update(products)
      .set({ status: 'draft' })
      .where(eq(products.id, p2.id));

    const freshPriceRes = await app.inject({
      method: 'GET',
      url: '/search?q=fone&mode=keyword',
    });
    const freshPriceBody = searchResponseSchema.parse(freshPriceRes.json());
    expect(freshPriceBody.items[0]?.price.amount).toBe(29990);

    const staleHiddenRes = await app.inject({
      method: 'GET',
      url: '/search?q=caixa&mode=keyword',
    });
    const staleHiddenBody = searchResponseSchema.parse(staleHiddenRes.json());
    expect(staleHiddenBody.items.find((i) => i.id === p2.id)).toBeUndefined();
  });

  it('degrades gracefully across all 3 layers: hybrid -> keyword -> postgres (always HTTP 200)', async () => {
    const db = databaseService.db;
    const cat = await createCategory(db, { slug: 'cafe', name: 'Café' });
    await createProduct(db, {
      categoryId: cat.id,
      slug: 'cafeteira-prensa',
      name: 'Cafeteira Prensa Francesa',
      description: 'Cafeteira artesanal de inox',
      regularPriceCents: 18990,
      inStock: true,
    });

    await indexCurrentProducts();

    // Layer 2: embedding provider fails -> degrades to 'keyword'
    fakeProvider.shouldFail = true;
    const kwFallbackRes = await app.inject({
      method: 'GET',
      url: '/search?q=cafeteira&mode=hybrid',
    });
    expect(kwFallbackRes.statusCode).toBe(200);
    const kwFallbackBody = searchResponseSchema.parse(kwFallbackRes.json());
    expect(kwFallbackBody.mode).toBe('keyword');
    expect(kwFallbackBody.items).toHaveLength(1);

    // Layer 3: search engine unreachable -> degrades to 'postgres'
    configureSearchTestEnv({ MEILI_HOST: 'http://127.0.0.1:1' });
    const { app: offlineApp } = await createApp({ env: loadEnv() });
    await offlineApp.init();
    await offlineApp.getHttpAdapter().getInstance().ready();

    try {
      const pgFallbackRes = await offlineApp.inject({
        method: 'GET',
        url: '/search?q=cafeteira',
      });
      expect(pgFallbackRes.statusCode).toBe(200);
      const pgFallbackBody = searchResponseSchema.parse(pgFallbackRes.json());
      expect(pgFallbackBody.mode).toBe('postgres');
      expect(pgFallbackBody.items.map((i) => i.slug)).toEqual(['cafeteira-prensa']);

      // Suggest also degrades cleanly to 'postgres'
      const suggestFallbackRes = await offlineApp.inject({
        method: 'GET',
        url: '/search/suggest?q=cafe',
      });
      expect(suggestFallbackRes.statusCode).toBe(200);
      const suggestFallbackBody = searchSuggestResponseSchema.parse(suggestFallbackRes.json());
      expect(suggestFallbackBody.mode).toBe('postgres');
      expect(suggestFallbackBody.suggestions[0]?.slug).toBe('cafeteira-prensa');
    } finally {
      await offlineApp.close();
      configureSearchTestEnv();
    }
  });

  it('GET /search/suggest returns max 8 lexical suggestions without calling embeddings, and validates params', async () => {
    const db = databaseService.db;
    const cat = await createCategory(db, { slug: 'acessorios', name: 'Acessórios' });
    await createProduct(db, {
      categoryId: cat.id,
      slug: 'oculos-aviator',
      name: 'Óculos de Sol Aviator',
      description: 'Proteção UV400',
      regularPriceCents: 15990,
      inStock: true,
    });

    await indexCurrentProducts();

    const suggestRes = await app.inject({ method: 'GET', url: '/search/suggest?q=ocul' });
    expect(suggestRes.statusCode).toBe(200);
    const suggestBody = searchSuggestResponseSchema.parse(suggestRes.json());
    expect(suggestBody.mode).toBe('keyword');
    expect(suggestBody.suggestions).toEqual([
      {
        slug: 'oculos-aviator',
        name: 'Óculos de Sol Aviator',
        categoryName: 'Acessórios',
        categorySlug: 'acessorios',
      },
    ]);
    expect(fakeProvider.callCount).toBe(0);

    // Multi-currency GET /search?currency=USD returns USD prices and applies price bounds in USD
    const usdRes = await app.inject({
      method: 'GET',
      url: '/search?q=ocul&currency=USD&maxPrice=3500&mode=keyword',
    });
    expect(usdRes.statusCode).toBe(200);
    const usdBody = searchResponseSchema.parse(usdRes.json());
    expect(usdBody.items.length).toBeGreaterThanOrEqual(1);
    expect(usdBody.items[0]?.price.currency).toBe('USD');
    expect(usdBody.items[0]?.price.amount).toBeLessThanOrEqual(3500);

    const usdExcludedRes = await app.inject({
      method: 'GET',
      url: '/search?q=ocul&currency=USD&maxPrice=3000&mode=keyword',
    });
    expect(usdExcludedRes.statusCode).toBe(200);
    const usdExcludedBody = searchResponseSchema.parse(usdExcludedRes.json());
    expect(usdExcludedBody.items).toHaveLength(0);

    // Parameter validation -> 400 VALIDATION_ERROR
    for (const badUrl of [
      '/search',
      '/search?q=fone&limit=61',
      '/search?q=fone&offset=201',
      '/search?q=fone&mode=postgres',
      '/search?q=fone&currency=JPY',
      '/search?q=fone&unknown=1',
      '/search/suggest',
      '/search/suggest?q=fone&limit=9',
    ]) {
      const res = await app.inject({ method: 'GET', url: badUrl });
      expect(res.statusCode).toBe(400);
      expect(apiErrorResponseSchema.parse(res.json()).error.code).toBe('VALIDATION_ERROR');
    }
  });
});
