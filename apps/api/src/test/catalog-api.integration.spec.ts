import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  apiErrorResponseSchema,
  categoriesResponseSchema,
  facetsDtoSchema,
  favoriteCreatedResponseSchema,
  favoritesListResponseSchema,
  productDetailDtoSchema,
  productListResponseSchema,
} from '@minieshop/contracts';
import { createApp } from '../app.factory.js';
import { loadEnv, resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import {
  createAttributeDefinition,
  createCategory,
  createProduct,
  createProductImageWithAsset,
} from './factories.js';
import {
  ensureTestDatabaseReady,
  getTestDatabaseUrl,
  truncateCatalogAndMedia,
} from './integration-db.js';

function configureTestEnv(overrides: Record<string, string> = {}): void {
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
  process.env.CORS_ORIGINS ??= 'http://localhost:5199';
  process.env.COOKIE_SECRET ??= 'minieshop-test-cookie-secret-123456';
  process.env.CHAOS_ENABLED = 'false';

  for (const [k, v] of Object.entries(overrides)) {
    process.env[k] = v;
  }
}

describe('Phase 2 API Integration Suite (real Postgres app_test + Fastify inject)', () => {
  let app: NestFastifyApplication;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    configureTestEnv();
    await ensureTestDatabaseReady(process.env.DATABASE_URL!);

    const created = await createApp({ env: loadEnv() });
    app = created.app;
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    databaseService = app.get(DatabaseService);
  });

  beforeEach(async () => {
    await truncateCatalogAndMedia(databaseService.db);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /categories returns sorted tree with published descendant counts and supports ETag/304', async () => {
    const db = databaseService.db;
    const rootB = await createCategory(db, { slug: 'beta', name: 'Beta', sortOrder: 2 });
    const rootA = await createCategory(db, { slug: 'alpha', name: 'Alpha', sortOrder: 1 });
    const childB = await createCategory(db, {
      slug: 'child-b',
      name: 'Zeta Child',
      parentId: rootA.id,
      sortOrder: 1,
    });
    const childA = await createCategory(db, {
      slug: 'child-a',
      name: 'Aha Child',
      parentId: rootA.id,
      sortOrder: 1,
    });

    await createProduct(db, { categoryId: childA.id, status: 'published' });
    await createProduct(db, { categoryId: childA.id, status: 'draft' });
    await createProduct(db, { categoryId: childB.id, status: 'published' });
    await createProduct(db, { categoryId: rootB.id, status: 'archived' });

    const res = await app.inject({ method: 'GET', url: '/categories' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=30');
    expect(res.headers['etag']).toBeTruthy();
    expect(res.headers['set-cookie']).toBeUndefined();

    const tree = categoriesResponseSchema.parse(res.json());
    expect(tree).toHaveLength(2);
    expect(tree[0]?.slug).toBe('alpha');
    expect(tree[0]?.productCount).toBe(2);
    expect(tree[0]?.children.map((c) => c.slug)).toEqual(['child-a', 'child-b']);
    expect(tree[0]?.children.map((c) => c.productCount)).toEqual([1, 1]);
    expect(tree[1]?.slug).toBe('beta');
    expect(tree[1]?.productCount).toBe(0);

    const res304 = await app.inject({
      method: 'GET',
      url: '/categories',
      headers: { 'if-none-match': String(res.headers['etag']) },
    });
    expect(res304.statusCode).toBe(304);
  });

  it('GET /products supports combined filters, accent-insensitive FTS, and rejects invalid params', async () => {
    const db = databaseService.db;
    const root = await createCategory(db, { slug: 'eletronicos', name: 'Eletrônicos' });
    const audio = await createCategory(db, { slug: 'audio', name: 'Áudio', parentId: root.id });
    const other = await createCategory(db, { slug: 'outros', name: 'Outros' });

    await createAttributeDefinition(db, {
      code: 'material',
      label: 'Material',
      dataType: 'enum',
      isFilterable: true,
      showOnCard: true,
      sortOrder: 1,
    });
    await createAttributeDefinition(db, {
      code: 'water_resistant',
      label: 'Resistente à água',
      dataType: 'boolean',
      isFilterable: true,
      showOnCard: true,
      sortOrder: 2,
    });
    await createAttributeDefinition(db, {
      code: 'battery_hours',
      label: 'Autonomia',
      dataType: 'number',
      unit: 'h',
      isFilterable: true,
      showOnCard: true,
      sortOrder: 3,
    });
    await createAttributeDefinition(db, {
      code: 'internal_dpi',
      label: 'DPI',
      dataType: 'number',
      isFilterable: false,
      showOnCard: false,
      sortOrder: 4,
    });

    await createProduct(db, {
      categoryId: audio.id,
      slug: 'oculos-audio-pro',
      name: 'Óculos de Áudio Bluetooth',
      description: 'Som estéreo com proteção à prova de respingos',
      regularPriceCents: 30000,
      specialPriceCents: 20000,
      inStock: true,
      attributes: { material: 'Alumínio', water_resistant: true, battery_hours: 20 },
    });

    await createProduct(db, {
      categoryId: audio.id,
      slug: 'fone-basico',
      name: 'Fone Básico',
      description: 'Fone leve para uso diário',
      regularPriceCents: 15000,
      inStock: false,
      attributes: { material: 'Plástico', water_resistant: false, battery_hours: 5 },
    });

    await createProduct(db, {
      categoryId: other.id,
      slug: 'oculos-draft',
      name: 'Óculos Rascunho',
      description: 'Não publicado',
      regularPriceCents: 20000,
      inStock: true,
      status: 'draft',
      attributes: { material: 'Alumínio', water_resistant: true, battery_hours: 30 },
    });

    // Accent-insensitive FTS + combined category/price/inStock/attr filters
    const res = await app.inject({
      method: 'GET',
      url: '/products?category=eletronicos&minPrice=18000&maxPrice=25000&inStock=true&q=oculos&sort=relevance&attr.material=Alumínio,Couro&attr.water_resistant=true&attr.battery_hours.min=10&attr.battery_hours.max=30',
    });
    expect(res.statusCode).toBe(200);
    const body = productListResponseSchema.parse(res.json());
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.slug).toBe('oculos-audio-pro');
    expect(body.items[0]?.price).toEqual({ amount: 20000, currency: 'BRL' });
    expect(body.items[0]?.highlights.map((h) => h.code)).toEqual([
      'material',
      'water_resistant',
      'battery_hours',
    ]);

    // Invalid params -> 400 VALIDATION_ERROR
    for (const badUrl of [
      '/products?unknownParam=1',
      '/products?attr.internal_dpi.min=100',
      '/products?attr.nonexistent=foo',
      '/products?sort=relevance',
      '/products?limit=61',
      '/products?minPrice=5000&maxPrice=1000',
      '/products?cursor=not-a-valid-cursor',
    ]) {
      const badRes = await app.inject({ method: 'GET', url: badUrl });
      expect(badRes.statusCode).toBe(400);
      const err = apiErrorResponseSchema.parse(badRes.json());
      expect(err.error.code).toBe('VALIDATION_ERROR');
      expect(err.error.details && err.error.details.length).toBeGreaterThan(0);
    }
  });

  it('GET /products keyset cursor pagination never duplicates or loses items across all sorts including tied prices & relevance', async () => {
    const db = databaseService.db;
    const cat = await createCategory(db, { slug: 'geral', name: 'Geral' });

    const baseTime = new Date('2026-01-01T00:00:00.000Z').getTime();
    const createdIds: string[] = [];

    // 7 products with intentionally tied prices (10000 x 3, 20000 x 2, 30000 x 2) and identical FTS keyword "cafeteira"
    const prices = [10000, 10000, 10000, 20000, 20000, 30000, 30000];
    for (let i = 0; i < prices.length; i++) {
      const p = await createProduct(db, {
        categoryId: cat.id,
        slug: `cafeteira-${i + 1}`,
        name: `Cafeteira Modelo ${String.fromCharCode(65 + i)}`,
        description: 'Cafeteira artesanal de inox para café filtrado',
        regularPriceCents: prices[i],
        createdAt: new Date(baseTime + (i % 3) * 1000), // intentional timestamp ties too
      });
      createdIds.push(p.id);
    }

    const sorts = [
      { sort: 'newest', extra: '' },
      { sort: 'price_asc', extra: '' },
      { sort: 'price_desc', extra: '' },
      { sort: 'name_asc', extra: '' },
      { sort: 'relevance', extra: '&q=cafeteira' },
    ] as const;

    for (const { sort, extra } of sorts) {
      const collected: string[] = [];
      let cursor: string | null = null;
      let guard = 0;

      do {
        guard++;
        expect(guard).toBeLessThan(20);
        const url = `/products?sort=${sort}&limit=2${extra}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
        const res = await app.inject({ method: 'GET', url });
        expect(res.statusCode).toBe(200);
        const page = productListResponseSchema.parse(res.json());
        for (const item of page.items) {
          collected.push(item.id);
        }
        cursor = page.nextCursor;
      } while (cursor !== null);

      expect(collected).toHaveLength(createdIds.length);
      expect(new Set(collected).size).toBe(createdIds.length);
    }
  });

  it('handles products without image and non-ready media assets (pending/failed) as null/empty, while sorting ready variants by width', async () => {
    const db = databaseService.db;
    const cat = await createCategory(db, { slug: 'midia', name: 'Mídia' });

    const withReady = await createProduct(db, { categoryId: cat.id, slug: 'com-imagem-pronta' });
    const withPending = await createProduct(db, { categoryId: cat.id, slug: 'com-imagem-pendente' });
    const withFailed = await createProduct(db, { categoryId: cat.id, slug: 'com-imagem-falha' });
    const withoutImage = await createProduct(db, { categoryId: cat.id, slug: 'sem-imagem' });

    await createProductImageWithAsset(db, {
      productId: withReady.id,
      status: 'ready',
      altText: 'Ready primary image',
      isPrimary: true,
    });
    await createProductImageWithAsset(db, {
      productId: withPending.id,
      status: 'pending',
      altText: 'Pending image',
      isPrimary: true,
    });
    await createProductImageWithAsset(db, {
      productId: withFailed.id,
      status: 'failed',
      altText: 'Failed image',
      isPrimary: true,
    });

    const listRes = await app.inject({ method: 'GET', url: '/products?limit=20' });
    expect(listRes.statusCode).toBe(200);
    const list = productListResponseSchema.parse(listRes.json());

    const bySlug = new Map(list.items.map((item) => [item.slug, item]));
    const readyCard = bySlug.get('com-imagem-pronta');
    expect(readyCard?.image).not.toBeNull();
    expect(readyCard?.image?.variants.map((v) => v.width)).toEqual([200, 600, 1200]);

    expect(bySlug.get('com-imagem-pendente')?.image).toBeNull();
    expect(bySlug.get('com-imagem-falha')?.image).toBeNull();
    expect(bySlug.get('sem-imagem')?.image).toBeNull();

    // Detail for product with pending image must return images: []
    const detailPendingRes = await app.inject({
      method: 'GET',
      url: '/products/com-imagem-pendente',
    });
    expect(detailPendingRes.statusCode).toBe(200);
    const detailPending = productDetailDtoSchema.parse(detailPendingRes.json());
    expect(detailPending.images).toEqual([]);

    // Detail for product without image must return images: []
    const detailNoImgRes = await app.inject({
      method: 'GET',
      url: `/products/${withoutImage.slug}`,
    });
    expect(detailNoImgRes.statusCode).toBe(200);
    expect(productDetailDtoSchema.parse(detailNoImgRes.json()).images).toEqual([]);
  });

  it('GET /products/:slug returns full detail with breadcrumbs and 404 for unknown or unpublished products', async () => {
    const db = databaseService.db;
    const root = await createCategory(db, { slug: 'casa', name: 'Casa' });
    const leaf = await createCategory(db, { slug: 'cafe', name: 'Café', parentId: root.id });

    await createAttributeDefinition(db, {
      code: 'capacity_ml',
      label: 'Capacidade',
      dataType: 'number',
      unit: 'ml',
      iconKey: 'cup',
      showOnCard: false,
      sortOrder: 1,
    });

    const published = await createProduct(db, {
      categoryId: leaf.id,
      slug: 'prensa-francesa',
      name: 'Prensa Francesa',
      description: 'Cafeteira em inox',
      regularPriceCents: 18990,
      attributes: { capacity_ml: 600 },
    });
    await createProduct(db, {
      categoryId: leaf.id,
      slug: 'produto-rascunho',
      status: 'draft',
    });

    const res = await app.inject({ method: 'GET', url: `/products/${published.slug}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=30');
    expect(res.headers['etag']).toBeTruthy();

    const detail = productDetailDtoSchema.parse(res.json());
    expect(detail.breadcrumbs).toEqual([
      { slug: 'casa', name: 'Casa' },
      { slug: 'cafe', name: 'Café' },
    ]);
    expect(detail.attributes).toEqual([
      { code: 'capacity_ml', label: 'Capacidade', value: 600, unit: 'ml', icon: 'cup' },
    ]);

    // 404 for non-existent slug and draft product
    for (const slug of ['nao-existe', 'produto-rascunho']) {
      const r404 = await app.inject({ method: 'GET', url: `/products/${slug}` });
      expect(r404.statusCode).toBe(404);
      const err = apiErrorResponseSchema.parse(r404.json());
      expect(err.error.code).toBe('NOT_FOUND');
    }
  });

  it('GET /products/facets computes disjunctive counts strictly equivalent to GET /products', async () => {
    const db = databaseService.db;
    const root = await createCategory(db, { slug: 'eletronicos', name: 'Eletrônicos' });
    const audio = await createCategory(db, { slug: 'audio', name: 'Áudio', parentId: root.id });
    const setup = await createCategory(db, { slug: 'setup', name: 'Setup', parentId: root.id });

    await createAttributeDefinition(db, {
      code: 'material',
      label: 'Material',
      dataType: 'enum',
      isFilterable: true,
      sortOrder: 1,
    });
    await createAttributeDefinition(db, {
      code: 'water_resistant',
      label: 'Resistente à água',
      dataType: 'boolean',
      isFilterable: true,
      sortOrder: 2,
    });
    await createAttributeDefinition(db, {
      code: 'battery_hours',
      label: 'Autonomia',
      dataType: 'number',
      unit: 'h',
      isFilterable: true,
      sortOrder: 3,
    });

    await createProduct(db, {
      categoryId: audio.id,
      regularPriceCents: 10000,
      attributes: { material: 'Alumínio', water_resistant: true, battery_hours: 15 },
    });
    await createProduct(db, {
      categoryId: audio.id,
      regularPriceCents: 25000,
      attributes: { material: 'Plástico', water_resistant: true, battery_hours: 40 },
    });
    await createProduct(db, {
      categoryId: setup.id,
      regularPriceCents: 40000,
      attributes: { material: 'Alumínio', water_resistant: false, battery_hours: 10 },
    });

    // Apply both category=audio and attr.material=Alumínio:
    // - categories facet must ignore category=audio (so setup still appears with count=1)
    // - material facet must ignore attr.material=Alumínio (so Plástico still appears with count=1 in audio)
    const facetsRes = await app.inject({
      method: 'GET',
      url: '/products/facets?category=audio&attr.material=Alumínio',
    });
    expect(facetsRes.statusCode).toBe(200);
    const facets = facetsDtoSchema.parse(facetsRes.json());

    // Equivalence check for every category option (replacing category, keeping attr.material=Alumínio)
    for (const catFacet of facets.categories) {
      const listRes = await app.inject({
        method: 'GET',
        url: `/products?limit=60&category=${encodeURIComponent(catFacet.slug)}&attr.material=Alumínio`,
      });
      const list = productListResponseSchema.parse(listRes.json());
      expect(list.items.length).toBe(catFacet.count);
    }

    // Equivalence check for every attribute option (replacing that attribute, keeping category=audio + other attrs)
    for (const attrFacet of facets.attributes) {
      if (!attrFacet.options) continue;
      for (const opt of attrFacet.options) {
        const otherAttrPart =
          attrFacet.code === 'material' ? '' : '&attr.material=Alum%C3%ADnio';
        const listRes = await app.inject({
          method: 'GET',
          url: `/products?limit=60&category=audio${otherAttrPart}&attr.${attrFacet.code}=${encodeURIComponent(opt.value)}`,
        });
        const list = productListResponseSchema.parse(listRes.json());
        expect(list.items.length).toBe(opt.count);
      }
    }

    // Verify price range facet ignores minPrice/maxPrice
    const priceFacetsRes = await app.inject({
      method: 'GET',
      url: '/products/facets?minPrice=20000&maxPrice=30000',
    });
    const priceFacets = facetsDtoSchema.parse(priceFacetsRes.json());
    expect(priceFacets.price).toEqual({ min: 10000, max: 40000 });

    // Empty result set returns { min: null, max: null }
    const emptyRes = await app.inject({ method: 'GET', url: '/products/facets?category=nope' });
    expect(facetsDtoSchema.parse(emptyRes.json()).price).toEqual({ min: null, max: null });

    // Rejects sort/limit/cursor on /products/facets
    const badRes = await app.inject({ method: 'GET', url: '/products/facets?limit=10' });
    expect(badRes.statusCode).toBe(400);
  });

  it('Favorites endpoints issue signed anon_id cookie, enforce idempotency, no-store cache, and 404 on invalid products', async () => {
    const db = databaseService.db;
    const cat = await createCategory(db, { slug: 'fav', name: 'Fav' });
    const pub = await createProduct(db, { categoryId: cat.id, slug: 'fav-pub' });
    const draft = await createProduct(db, {
      categoryId: cat.id,
      slug: 'fav-draft',
      status: 'draft',
    });

    // First POST creates signed HttpOnly SameSite=Lax cookie
    const p1 = await app.inject({ method: 'POST', url: `/favorites/${pub.id}` });
    expect(p1.statusCode).toBe(200);
    expect(p1.headers['cache-control']).toBe('no-store');
    expect(favoriteCreatedResponseSchema.parse(p1.json())).toEqual({ favorited: true });

    const setCookieHeader = String(p1.headers['set-cookie'] ?? '');
    expect(setCookieHeader).toContain('anon_id=');
    expect(setCookieHeader).toContain('HttpOnly');
    expect(setCookieHeader).toContain('SameSite=Lax');
    expect(setCookieHeader).toContain('Max-Age=31536000');

    const cookiePair = setCookieHeader.split(';')[0]!;

    // Repeat POST -> idempotent, does not re-issue cookie
    const p2 = await app.inject({
      method: 'POST',
      url: `/favorites/${pub.id}`,
      headers: { cookie: cookiePair },
    });
    expect(p2.statusCode).toBe(200);
    expect(p2.headers['set-cookie']).toBeUndefined();

    // GET returns single productId (no duplicate)
    const g1 = await app.inject({
      method: 'GET',
      url: '/favorites',
      headers: { cookie: cookiePair },
    });
    expect(g1.statusCode).toBe(200);
    expect(g1.headers['cache-control']).toBe('no-store');
    expect(favoritesListResponseSchema.parse(g1.json())).toEqual({ productIds: [pub.id] });

    // DELETE twice -> idempotent 204
    const d1 = await app.inject({
      method: 'DELETE',
      url: `/favorites/${pub.id}`,
      headers: { cookie: cookiePair },
    });
    expect(d1.statusCode).toBe(204);
    expect(d1.headers['cache-control']).toBe('no-store');

    const d2 = await app.inject({
      method: 'DELETE',
      url: `/favorites/${pub.id}`,
      headers: { cookie: cookiePair },
    });
    expect(d2.statusCode).toBe(204);

    // GET after delete -> empty
    const g2 = await app.inject({
      method: 'GET',
      url: '/favorites',
      headers: { cookie: cookiePair },
    });
    expect(favoritesListResponseSchema.parse(g2.json())).toEqual({ productIds: [] });

    // Draft & non-existent product -> 404
    for (const badId of [draft.id, '00000000-0000-4000-8000-000000000000']) {
      const r404 = await app.inject({
        method: 'POST',
        url: `/favorites/${badId}`,
        headers: { cookie: cookiePair },
      });
      expect(r404.statusCode).toBe(404);
      expect(apiErrorResponseSchema.parse(r404.json()).error.code).toBe('NOT_FOUND');
    }

    // Non-UUID -> 400
    const r400 = await app.inject({
      method: 'POST',
      url: '/favorites/not-a-uuid',
      headers: { cookie: cookiePair },
    });
    expect(r400.statusCode).toBe(400);
    expect(apiErrorResponseSchema.parse(r400.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('Chaos middleware is inactive when CHAOS_ENABLED=false and active when CHAOS_ENABLED=true', async () => {
    // Inactive on main app (CHAOS_ENABLED=false)
    const inactiveRes = await app.inject({
      method: 'GET',
      url: '/categories',
      headers: { 'x-chaos-fail': '1', 'x-chaos-status': '503' },
    });
    expect(inactiveRes.statusCode).toBe(200);

    // Active on separate test app instance (CHAOS_ENABLED=true, NODE_ENV=test)
    configureTestEnv({ CHAOS_ENABLED: 'true' });
    const { app: chaosApp } = await createApp({ env: loadEnv() });
    await chaosApp.init();
    await chaosApp.getHttpAdapter().getInstance().ready();

    try {
      const failRes = await chaosApp.inject({
        method: 'GET',
        url: '/categories',
        headers: { 'x-chaos-fail': '1' },
      });
      expect(failRes.statusCode).toBe(503);
      expect(apiErrorResponseSchema.parse(failRes.json()).error.code).toBe('CHAOS_FAILURE');

      const healthRes = await chaosApp.inject({
        method: 'GET',
        url: '/health',
        headers: { 'x-chaos-fail': '1' },
      });
      expect(healthRes.statusCode).toBe(200);
    } finally {
      await chaosApp.close();
      configureTestEnv({ CHAOS_ENABLED: 'false' });
    }

    // Booting in production with CHAOS_ENABLED=true must fail
    configureTestEnv({ NODE_ENV: 'production', CHAOS_ENABLED: 'true' });
    await expect(createApp({ env: loadEnv() })).rejects.toThrow(/CHAOS_ENABLED=true is forbidden/);
    configureTestEnv({ NODE_ENV: 'test', CHAOS_ENABLED: 'false' });
  });
});
