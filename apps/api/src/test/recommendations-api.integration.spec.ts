import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  apiErrorResponseSchema,
  cartCrossSellResponseSchema,
  productRecommendationsResponseSchema,
} from '@minieshop/contracts';
import { createApp } from '../app.factory.js';
import { resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { categoryComplements, productRelations } from '../database/schema/index.js';
import { CatalogService } from '../modules/catalog/index.js';
import { RelationsService } from '../modules/recommendations/index.js';
import { createCategory, createProduct, createProductImageWithAsset } from './factories.js';
import {
  ensureTestDatabaseReady,
  getTestDatabaseUrl,
  truncateCatalogAndMedia,
} from './integration-db.js';

describe('R04 — Recommendations HTTP Endpoints (PDP & Cart Cross-Sell)', () => {
  let app: NestFastifyApplication;
  let databaseService: DatabaseService;
  let catalogService: CatalogService;
  let relationsService: RelationsService;

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
    process.env.CHAOS_ENABLED = 'false';

    await ensureTestDatabaseReady(process.env.DATABASE_URL);
    const created = await createApp();
    app = created.app;
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    databaseService = app.get(DatabaseService);
    catalogService = app.get(CatalogService);
    relationsService = app.get(RelationsService);
  });

  beforeEach(async () => {
    await truncateCatalogAndMedia(databaseService.db);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves PDP recommendations with manual first, filters out-of-stock/unpublished, supports ETag and empty lists', async () => {
    const audio = await createCategory(databaseService.db, { slug: 'audio-api' });
    const bags = await createCategory(databaseService.db, { slug: 'bags-api' });
    const isolated = await createCategory(databaseService.db, { slug: 'isolated-api' });

    await databaseService.db.insert(categoryComplements).values({
      categoryId: audio.id,
      complementCategoryId: bags.id,
      position: 0,
    });

    const pMain = await createProduct(databaseService.db, {
      categoryId: audio.id,
      slug: 'fone-main',
      regularPriceCents: 20000,
      inStock: true,
    });
    const pRelInStock = await createProduct(databaseService.db, {
      categoryId: audio.id,
      slug: 'fone-rel-ok',
      regularPriceCents: 21000,
      inStock: true,
    });
    const pRelOos = await createProduct(databaseService.db, {
      categoryId: audio.id,
      slug: 'fone-rel-oos',
      regularPriceCents: 22000,
      inStock: false,
    });
    const pUpsell = await createProduct(databaseService.db, {
      categoryId: audio.id,
      slug: 'fone-upsell-pro',
      regularPriceCents: 32000,
      inStock: true,
    });
    const pBag = await createProduct(databaseService.db, {
      categoryId: bags.id,
      slug: 'mochila-cross',
      regularPriceCents: 18000,
      inStock: true,
    });
    const pLonely = await createProduct(databaseService.db, {
      categoryId: isolated.id,
      slug: 'produto-sem-relacoes',
      regularPriceCents: 10000,
      inStock: true,
    });
    const pDraft = await createProduct(databaseService.db, {
      categoryId: audio.id,
      slug: 'produto-rascunho',
      status: 'draft',
    });

    await createProductImageWithAsset(databaseService.db, { productId: pRelInStock.id });

    // Recompute auto (rule) relations for pMain, then add manual override putting pBag at position 0 of related
    await relationsService.recompute(pMain.id, { cascade: false });
    await relationsService.addManualRelation({
      productSlug: pMain.slug,
      relatedProductSlug: pBag.slug,
      type: 'related',
      position: 0,
    });

    // 1. Default PDP recommendations: manual first, out-of-stock excluded, ETag & Cache-Control present
    const res = await app.inject({
      method: 'GET',
      url: `/products/${pMain.slug}/recommendations`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('public');
    expect(res.headers['etag']).toBeDefined();

    const body = productRecommendationsResponseSchema.parse(res.json());
    expect(body.related).toBeDefined();
    expect(body.upsell).toBeDefined();
    expect(body.cross_sell).toBeDefined();
    // Manual relation appears first
    expect(body.related![0]?.slug).toBe(pBag.slug);
    // Out-of-stock product is excluded by default
    expect(body.related!.some((c) => c.slug === pRelOos.slug)).toBe(false);
    expect(body.related!.some((c) => c.slug === pRelInStock.slug)).toBe(true);
    expect(body.upsell!.some((c) => c.slug === pUpsell.slug)).toBe(true);
    expect(body.cross_sell!.some((c) => c.slug === pBag.slug)).toBe(true);

    // 2. Conditional 304 Not Modified via If-None-Match
    const res304 = await app.inject({
      method: 'GET',
      url: `/products/${pMain.slug}/recommendations`,
      headers: { 'if-none-match': String(res.headers['etag']) },
    });
    expect(res304.statusCode).toBe(304);

    // 3. includeOutOfStock=true includes out-of-stock product for debugging
    const resDebug = await app.inject({
      method: 'GET',
      url: `/products/${pMain.slug}/recommendations?types=related&includeOutOfStock=true`,
    });
    expect(resDebug.statusCode).toBe(200);
    const debugBody = productRecommendationsResponseSchema.parse(resDebug.json());
    expect(debugBody.upsell).toBeUndefined();
    expect(debugBody.cross_sell).toBeUndefined();
    expect(debugBody.related!.some((c) => c.slug === pRelOos.slug)).toBe(true);

    // 4. Product without relations returns empty arrays (HTTP 200, never error)
    const resLonely = await app.inject({
      method: 'GET',
      url: `/products/${pLonely.slug}/recommendations`,
    });
    expect(resLonely.statusCode).toBe(200);
    expect(productRecommendationsResponseSchema.parse(resLonely.json())).toEqual({
      related: [],
      upsell: [],
      cross_sell: [],
    });

    // 5. Draft or unknown slug returns standardized 404
    for (const slug of [pDraft.slug, 'nao-existe-mesmo']) {
      const res404 = await app.inject({
        method: 'GET',
        url: `/products/${slug}/recommendations`,
      });
      expect(res404.statusCode).toBe(404);
      const err = apiErrorResponseSchema.parse(res404.json());
      expect(err.error.code).toBe('NOT_FOUND');
    }

    // 6. Unpublishing a related product hides it immediately on read (live hydration)
    await catalogService.setProductStatus(pUpsell.id, 'archived');
    const resAfterArchive = await app.inject({
      method: 'GET',
      url: `/products/${pMain.slug}/recommendations?types=upsell`,
    });
    expect(resAfterArchive.statusCode).toBe(200);
    const afterArchiveBody = productRecommendationsResponseSchema.parse(resAfterArchive.json());
    expect(afterArchiveBody.upsell!.some((c) => c.slug === pUpsell.slug)).toBe(false);
  });

  it('serves cart cross-sell for 1 and multiple productIds, excludes cart items, sums scores, and validates params', async () => {
    const cat = await createCategory(databaseService.db, { slug: 'cart-cat' });

    const pCart1 = await createProduct(databaseService.db, { categoryId: cat.id, slug: 'cart-1' });
    const pCart2 = await createProduct(databaseService.db, { categoryId: cat.id, slug: 'cart-2' });
    const pManual = await createProduct(databaseService.db, {
      categoryId: cat.id,
      slug: 'cross-manual',
    });
    const pShared = await createProduct(databaseService.db, {
      categoryId: cat.id,
      slug: 'cross-shared',
    });
    const pSingleHigh = await createProduct(databaseService.db, {
      categoryId: cat.id,
      slug: 'cross-single-high',
    });
    const pOos = await createProduct(databaseService.db, {
      categoryId: cat.id,
      slug: 'cross-oos',
      inStock: false,
    });

    await databaseService.db.insert(productRelations).values([
      // pCart1 cross-sells: pManual (manual, pos 0), pShared (0.55), pCart2 (in cart -> must be excluded), pOos (0.90 -> OOS)
      {
        productId: pCart1.id,
        relatedProductId: pManual.id,
        type: 'cross_sell',
        source: 'manual',
        method: 'manual',
        score: null,
        position: 0,
      },
      {
        productId: pCart1.id,
        relatedProductId: pShared.id,
        type: 'cross_sell',
        source: 'auto',
        method: 'vector',
        score: '0.55000',
        position: 0,
      },
      {
        productId: pCart1.id,
        relatedProductId: pCart2.id,
        type: 'cross_sell',
        source: 'auto',
        method: 'vector',
        score: '0.99000',
        position: 1,
      },
      {
        productId: pCart1.id,
        relatedProductId: pOos.id,
        type: 'cross_sell',
        source: 'auto',
        method: 'vector',
        score: '0.90000',
        position: 2,
      },
      // pCart2 cross-sells: pShared (0.55 -> sum 1.10 > pSingleHigh 0.80!), pSingleHigh (0.80)
      {
        productId: pCart2.id,
        relatedProductId: pShared.id,
        type: 'cross_sell',
        source: 'auto',
        method: 'vector',
        score: '0.55000',
        position: 0,
      },
      {
        productId: pCart2.id,
        relatedProductId: pSingleHigh.id,
        type: 'cross_sell',
        source: 'auto',
        method: 'vector',
        score: '0.80000',
        position: 1,
      },
    ]);

    // 1. Single productId
    const resSingle = await app.inject({
      method: 'GET',
      url: `/recommendations/cross-sell?productIds=${pCart1.id}`,
    });
    expect(resSingle.statusCode).toBe(200);
    const singleBody = cartCrossSellResponseSchema.parse(resSingle.json());
    expect(singleBody.items.map((i) => i.slug)).toEqual(['cross-manual', 'cart-2', 'cross-shared']);

    // 2. Multiple productIds + nonexistent valid UUID silently ignored
    const ghostId = randomUUID();
    const resMulti = await app.inject({
      method: 'GET',
      url: `/recommendations/cross-sell?productIds=${pCart1.id},${pCart2.id},${ghostId}&limit=6`,
    });
    expect(resMulti.statusCode).toBe(200);
    const multiBody = cartCrossSellResponseSchema.parse(resMulti.json());
    // Manual first, then pShared (sum 1.10) before pSingleHigh (0.80); pCart2 and pOos excluded
    expect(multiBody.items.map((i) => i.slug)).toEqual([
      'cross-manual',
      'cross-shared',
      'cross-single-high',
    ]);

    // 3. Validation errors -> 400 VALIDATION_ERROR
    const badUrls = [
      '/recommendations/cross-sell',
      '/recommendations/cross-sell?productIds=not-a-uuid',
      `/recommendations/cross-sell?productIds=${Array.from({ length: 21 }, () => randomUUID()).join(',')}`,
      `/recommendations/cross-sell?productIds=${pCart1.id}&limit=13`,
      `/products/${pCart1.slug}/recommendations?types=unknown_type`,
      `/products/${pCart1.slug}/recommendations?limit=0`,
    ];

    for (const url of badUrls) {
      const badRes = await app.inject({ method: 'GET', url });
      expect(badRes.statusCode).toBe(400);
      const err = apiErrorResponseSchema.parse(badRes.json());
      expect(err.error.code).toBe('VALIDATION_ERROR');
    }
  });
});
