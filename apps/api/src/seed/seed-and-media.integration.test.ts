import 'reflect-metadata';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { count, eq } from 'drizzle-orm';
import sharp from 'sharp';
import { DatabaseService } from '../database/database.service.js';
import {
  attributeDefinitions,
  categories,
  mediaAssets,
  productImages,
  products,
  productVariants,
  stockItems,
} from '../database/schema/index.js';
import { CatalogService } from '../modules/catalog/index.js';
import {
  MediaService,
  MediaValidationError,
  PUBLIC_IMMUTABLE_CACHE_CONTROL,
  S3StorageAdapter,
} from '../modules/media/index.js';
import { runSeed, type CatalogFixture } from './seed.js';

// Default to local Compose Postgres & SeaweedFS endpoints when invoked with a single command
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??=
  'postgresql://minieshop:minieshop_dev_password@localhost:5432/minieshop';
process.env.S3_ENDPOINT ??= 'http://localhost:8333';
process.env.S3_PUBLIC_ENDPOINT ??= 'http://localhost:8333';
process.env.S3_REGION ??= 'us-east-1';
process.env.S3_ACCESS_KEY_ID ??= 'minieshop_dev_access_key';
process.env.S3_SECRET_ACCESS_KEY ??= 'minieshop_dev_secret_key';
process.env.S3_PUBLIC_BUCKET ??= 'minieshop-catalog-public';
process.env.S3_PRIVATE_BUCKET ??= 'minieshop-private';

describe('Phase 1 Integration — Seed & MediaService (real Postgres + SeaweedFS)', () => {
  let databaseService: DatabaseService;
  let storageAdapter: S3StorageAdapter;
  let mediaService: MediaService;
  let catalogService: CatalogService;
  let fixture: CatalogFixture;

  before(async () => {
    databaseService = new DatabaseService();
    storageAdapter = new S3StorageAdapter();
    mediaService = new MediaService(databaseService, storageAdapter);
    catalogService = new CatalogService(databaseService, mediaService);

    const raw = await readFile(resolve(process.cwd(), 'seed/catalog-fixture.json'), 'utf8');
    fixture = JSON.parse(raw) as CatalogFixture;

    const ok = await databaseService.checkConnection();
    assert.equal(ok, true, 'PostgreSQL from Compose must be reachable');
  });

  after(async () => {
    await databaseService.onModuleDestroy();
  });

  it('matches fixture counts in PostgreSQL and keeps seed idempotent when executed twice', async () => {
    const firstRun = await runSeed({ databaseService, mediaService });
    const secondRun = await runSeed({ databaseService, mediaService });

    const expectedVariants = fixture.products.reduce((acc, p) => acc + p.variants.length, 0);
    const expectedImages = fixture.products.filter((p) => p.imageFile !== null).length;
    const expectedWithoutImage = fixture.products.length - expectedImages;

    assert.equal(firstRun.productsCount, fixture.products.length);
    assert.equal(secondRun.productsCount, fixture.products.length);
    assert.equal(secondRun.imagesUploaded, 0, 'Second seed run must not re-upload any image');
    assert.equal(
      secondRun.imagesDeduplicated,
      expectedImages,
      'Second seed run must deduplicate all existing images',
    );
    assert.equal(secondRun.productsWithoutImage, expectedWithoutImage);

    const [catCount] = await databaseService.db.select({ total: count() }).from(categories);
    const [attrCount] = await databaseService.db
      .select({ total: count() })
      .from(attributeDefinitions);
    const [prodCount] = await databaseService.db.select({ total: count() }).from(products);
    const [varCount] = await databaseService.db.select({ total: count() }).from(productVariants);
    const [stockCount] = await databaseService.db.select({ total: count() }).from(stockItems);
    const [imgCount] = await databaseService.db.select({ total: count() }).from(productImages);

    assert.equal(Number(catCount?.total), fixture.categories.length);
    assert.equal(Number(attrCount?.total), fixture.attributeDefinitions.length);
    assert.equal(Number(prodCount?.total), fixture.products.length);
    assert.equal(Number(varCount?.total), expectedVariants);
    assert.equal(Number(stockCount?.total), expectedVariants);
    assert.equal(Number(imgCount?.total), expectedImages);
  });

  it('rejects empty or corrupted files with INVALID_FILE', async () => {
    const [sampleProduct] = await databaseService.db
      .select({ id: products.id })
      .from(products)
      .limit(1);
    assert.ok(sampleProduct, 'Expected at least one seeded product');

    await assert.rejects(
      () =>
        mediaService.register({
          productId: sampleProduct.id,
          buffer: Buffer.alloc(0),
        }),
      (err: unknown) => err instanceof MediaValidationError && err.code === 'INVALID_FILE',
    );

    await assert.rejects(
      () =>
        mediaService.register({
          productId: sampleProduct.id,
          buffer: Buffer.from('this-is-not-an-image-at-all'),
        }),
      (err: unknown) => err instanceof MediaValidationError && err.code === 'INVALID_FILE',
    );
  });

  it('rejects unsupported image formats (GIF) with UNSUPPORTED_MIME_TYPE', async () => {
    const [sampleProduct] = await databaseService.db
      .select({ id: products.id })
      .from(products)
      .limit(1);
    assert.ok(sampleProduct, 'Expected at least one seeded product');

    const gifBuffer = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .gif()
      .toBuffer();

    await assert.rejects(
      () =>
        mediaService.register({
          productId: sampleProduct.id,
          buffer: gifBuffer,
        }),
      (err: unknown) => err instanceof MediaValidationError && err.code === 'UNSUPPORTED_MIME_TYPE',
    );
  });

  it('uploads original + WebP variants with immutable cache header and deduplicates repeated files', async () => {
    const [sampleProduct] = await databaseService.db
      .select({ id: products.id, slug: products.slug })
      .from(products)
      .where(eq(products.slug, 'organizador-de-mesa-em-madeira-aluminio'))
      .limit(1);
    assert.ok(sampleProduct, 'Expected seeded product for media deduplication test');

    // Generate a unique PNG for this test run (using timestamp-derived RGB pixel)
    const seed = Date.now() % 250;
    const pngBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: seed, g: (seed + 50) % 255, b: (seed + 100) % 255 },
      },
    })
      .png()
      .toBuffer();

    const first = await mediaService.register({
      productId: sampleProduct.id,
      buffer: pngBuffer,
    });

    await catalogService.linkProductImage({
      productId: sampleProduct.id,
      mediaAssetId: first.assetId,
      altText: 'Integration test image',
    });

    assert.equal(first.deduplicated, false);
    assert.ok(first.storageKey.startsWith(`products/${sampleProduct.id}/`));
    assert.ok(first.variants.thumb?.key.endsWith('/thumb.webp'));
    assert.ok(first.variants.card?.key.endsWith('/card.webp'));
    assert.ok(first.variants.detail?.key.endsWith('/detail.webp'));
    assert.ok(first.placeholderBase64?.startsWith('data:image/webp;base64,'));

    // Verify object exists in real SeaweedFS bucket with immutable Cache-Control
    const head = await storageAdapter.headObject(storageAdapter.publicBucket, first.storageKey);
    assert.ok(head, 'Original object must exist in SeaweedFS');
    assert.equal(head.CacheControl, PUBLIC_IMMUTABLE_CACHE_CONTROL);

    assert.ok(first.variants.card, 'Card variant must be present');
    const cardHead = await storageAdapter.headObject(
      storageAdapter.publicBucket,
      first.variants.card.key,
    );
    assert.ok(cardHead, 'Card WebP variant must exist in SeaweedFS');
    assert.equal(cardHead.ContentType, 'image/webp');
    assert.equal(cardHead.CacheControl, PUBLIC_IMMUTABLE_CACHE_CONTROL);

    // Register exact same buffer again -> must deduplicate without creating a second asset
    const second = await mediaService.register({
      productId: sampleProduct.id,
      buffer: pngBuffer,
    });

    assert.equal(second.deduplicated, true);
    assert.equal(second.assetId, first.assetId);
    assert.equal(second.storageKey, first.storageKey);

    // Clean up test-created link and asset so fallback product #29 remains clean
    await databaseService.db
      .delete(productImages)
      .where(eq(productImages.mediaAssetId, first.assetId));
    await databaseService.db.delete(mediaAssets).where(eq(mediaAssets.id, first.assetId));
  });
});
