import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { resetEnvCache } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { categoryComplements, productRelations } from '../database/schema/index.js';
import {
  ensureTestDatabaseReady,
  getTestDatabaseUrl,
  truncateCatalogAndMedia,
} from './integration-db.js';
import { createCategory, createProduct } from './factories.js';

describe('R02 — Recommendations Schema Constraints & Manual Override Conflict Rule', () => {
  let databaseService: DatabaseService;

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
  });

  beforeEach(async () => {
    await truncateCatalogAndMedia(databaseService.db);
  });

  afterAll(async () => {
    await databaseService?.onModuleDestroy();
  });

  it('rejects self-relation and duplicate (product_id, related_product_id, type) triples', async () => {
    const cat = await createCategory(databaseService.db, { slug: 'audio' });
    const p1 = await createProduct(databaseService.db, { categoryId: cat.id, slug: 'p1' });
    const p2 = await createProduct(databaseService.db, { categoryId: cat.id, slug: 'p2' });

    // Self-relation must fail CHECK constraint
    await expect(
      databaseService.db.insert(productRelations).values({
        productId: p1.id,
        relatedProductId: p1.id,
        type: 'related',
        source: 'manual',
        method: 'manual',
        score: null,
        position: 0,
      }),
    ).rejects.toThrow();

    // Valid auto relation
    await databaseService.db.insert(productRelations).values({
      productId: p1.id,
      relatedProductId: p2.id,
      type: 'related',
      source: 'auto',
      method: 'vector',
      score: '0.72500',
      position: 0,
    });

    // Duplicate (product_id, related_product_id, type) must fail UNIQUE constraint
    await expect(
      databaseService.db.insert(productRelations).values({
        productId: p1.id,
        relatedProductId: p2.id,
        type: 'related',
        source: 'auto',
        method: 'rule',
        score: '0.50000',
        position: 1,
      }),
    ).rejects.toThrow();

    // Same product pair with a different type is allowed
    await databaseService.db.insert(productRelations).values({
      productId: p1.id,
      relatedProductId: p2.id,
      type: 'upsell',
      source: 'auto',
      method: 'vector',
      score: '0.72500',
      position: 0,
    });

    // Self-pair on category_complements must fail CHECK constraint
    await expect(
      databaseService.db.insert(categoryComplements).values({
        categoryId: cat.id,
        complementCategoryId: cat.id,
        position: 0,
      }),
    ).rejects.toThrow();
  });

  it('converts an existing auto relation into manual on conflict (manual always prevails)', async () => {
    const cat = await createCategory(databaseService.db, { slug: 'audio-override' });
    const p1 = await createProduct(databaseService.db, { categoryId: cat.id, slug: 'p-src' });
    const p2 = await createProduct(databaseService.db, { categoryId: cat.id, slug: 'p-dst' });

    const [autoRow] = await databaseService.db
      .insert(productRelations)
      .values({
        productId: p1.id,
        relatedProductId: p2.id,
        type: 'related',
        source: 'auto',
        method: 'vector',
        score: '0.68000',
        position: 3,
      })
      .returning();

    expect(autoRow).toBeDefined();

    // Manual upsert on the same triple converts auto -> manual
    const [converted] = await databaseService.db
      .insert(productRelations)
      .values({
        productId: p1.id,
        relatedProductId: p2.id,
        type: 'related',
        source: 'manual',
        method: 'manual',
        score: null,
        position: 0,
      })
      .onConflictDoUpdate({
        target: [
          productRelations.productId,
          productRelations.relatedProductId,
          productRelations.type,
        ],
        set: {
          source: 'manual',
          method: 'manual',
          score: null,
          position: 0,
          updatedAt: new Date(),
        },
      })
      .returning();

    expect(converted?.id).toBe(autoRow?.id);
    expect(converted?.source).toBe('manual');
    expect(converted?.method).toBe('manual');
    expect(converted?.score).toBeNull();
    expect(converted?.position).toBe(0);

    // Ensure only 1 row exists for that triple
    const rows = await databaseService.db
      .select()
      .from(productRelations)
      .where(
        and(
          eq(productRelations.productId, p1.id),
          eq(productRelations.relatedProductId, p2.id),
          eq(productRelations.type, 'related'),
        ),
      );
    expect(rows).toHaveLength(1);
  });
});
