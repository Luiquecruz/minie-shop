import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import {
  attributeDefinitions,
  categories,
  categoryComplements,
  productRelations,
  products,
  productVariants,
  stockItems,
  storeSettings,
} from '../database/schema/index.js';
import { MediaService, S3StorageAdapter } from '../modules/media/index.js';
import { OutboxService } from '../modules/platform/index.js';

interface FixtureCategory {
  slug: string;
  name: string;
  parentSlug: string | null;
  sortOrder: number;
}

interface FixtureAttributeDefinition {
  code: string;
  label: string;
  dataType: 'string' | 'number' | 'boolean' | 'enum';
  unit: string | null;
  isFilterable: boolean;
  showOnCard: boolean;
  iconKey: string | null;
  sortOrder: number;
}

interface FixtureVariant {
  sku: string;
  name: string;
  attributes: Record<string, string>;
  priceCents: number | null;
  isDefault: boolean;
  sortOrder: number;
  stock: number;
}

interface FixtureProduct {
  legacyId: number;
  slug: string;
  sku: string;
  name: string;
  description: string;
  categorySlug: string;
  regularPriceCents: number;
  specialPriceCents: number | null;
  currency: string;
  ratingAverage: string;
  ratingCount: number;
  attributes: Record<string, unknown>;
  imageFile: string | null;
  variants: FixtureVariant[];
}

export interface CatalogFixture {
  categories: FixtureCategory[];
  attributeDefinitions: FixtureAttributeDefinition[];
  products: FixtureProduct[];
}

export interface SeedSummary {
  categoriesCount: number;
  attributesCount: number;
  productsCount: number;
  variantsCount: number;
  imagesUploaded: number;
  imagesDeduplicated: number;
  productsWithoutImage: number;
  categoryComplementsCount: number;
  manualRelationsCount: number;
}

export async function runSeed(options?: {
  databaseService?: DatabaseService;
  mediaService?: MediaService;
  fixtureDir?: string;
}): Promise<SeedSummary> {
  const ownsDb = !options?.databaseService;
  const databaseService = options?.databaseService ?? new DatabaseService();
  const storageAdapter = new S3StorageAdapter();
  const mediaService = options?.mediaService ?? new MediaService(databaseService, storageAdapter);
  const fixtureDir = options?.fixtureDir ?? resolve(process.cwd(), 'seed');

  const rawFixture = await readFile(resolve(fixtureDir, 'catalog-fixture.json'), 'utf8');
  const fixture = JSON.parse(rawFixture) as CatalogFixture;

  let variantsCount = 0;
  let imagesUploaded = 0;
  let imagesDeduplicated = 0;
  let productsWithoutImage = 0;

  try {
    const categoryIdBySlug = new Map<string, string>();

    // 1. Upsert root categories first, then child categories
    const roots = fixture.categories.filter((c) => c.parentSlug === null);
    const children = fixture.categories.filter((c) => c.parentSlug !== null);

    for (const cat of [...roots, ...children]) {
      const parentId = cat.parentSlug ? (categoryIdBySlug.get(cat.parentSlug) ?? null) : null;
      const [row] = await databaseService.db
        .insert(categories)
        .values({
          slug: cat.slug,
          name: cat.name,
          parentId,
          sortOrder: cat.sortOrder,
        })
        .onConflictDoUpdate({
          target: categories.slug,
          set: {
            name: cat.name,
            parentId,
            sortOrder: cat.sortOrder,
            updatedAt: new Date(),
          },
        })
        .returning({ id: categories.id, slug: categories.slug });

      if (row) {
        categoryIdBySlug.set(row.slug, row.id);
      }
    }

    // 2. Upsert attribute definitions
    for (const attr of fixture.attributeDefinitions) {
      await databaseService.db
        .insert(attributeDefinitions)
        .values({
          code: attr.code,
          label: attr.label,
          dataType: attr.dataType,
          unit: attr.unit,
          isFilterable: attr.isFilterable,
          showOnCard: attr.showOnCard,
          iconKey: attr.iconKey,
          sortOrder: attr.sortOrder,
        })
        .onConflictDoUpdate({
          target: attributeDefinitions.code,
          set: {
            label: attr.label,
            dataType: attr.dataType,
            unit: attr.unit,
            isFilterable: attr.isFilterable,
            showOnCard: attr.showOnCard,
            iconKey: attr.iconKey,
            sortOrder: attr.sortOrder,
            updatedAt: new Date(),
          },
        });
    }

    // 3. Upsert products, variants, stock_items, in_stock projection, and media
    for (const item of fixture.products) {
      const categoryId = categoryIdBySlug.get(item.categorySlug);
      if (!categoryId) {
        throw new Error(`Missing categoryId for slug "${item.categorySlug}"`);
      }

      const [productRow] = await databaseService.db
        .insert(products)
        .values({
          categoryId,
          slug: item.slug,
          sku: item.sku,
          name: item.name,
          description: item.description,
          regularPriceCents: item.regularPriceCents,
          specialPriceCents: item.specialPriceCents,
          currency: item.currency,
          inStock: false,
          ratingAverage: item.ratingAverage,
          ratingCount: item.ratingCount,
          attributes: item.attributes,
        })
        .onConflictDoUpdate({
          target: products.slug,
          set: {
            categoryId,
            sku: item.sku,
            name: item.name,
            description: item.description,
            regularPriceCents: item.regularPriceCents,
            specialPriceCents: item.specialPriceCents,
            currency: item.currency,
            ratingAverage: item.ratingAverage,
            ratingCount: item.ratingCount,
            attributes: item.attributes,
            updatedAt: new Date(),
          },
        })
        .returning({ id: products.id });

      if (!productRow) {
        throw new Error(`Failed to upsert product "${item.slug}"`);
      }

      let hasAvailableStock = false;

      for (const variant of item.variants) {
        variantsCount += 1;
        const [variantRow] = await databaseService.db
          .insert(productVariants)
          .values({
            productId: productRow.id,
            sku: variant.sku,
            name: variant.name,
            attributes: variant.attributes,
            priceCents: variant.priceCents,
            isDefault: variant.isDefault,
            sortOrder: variant.sortOrder,
          })
          .onConflictDoUpdate({
            target: productVariants.sku,
            set: {
              productId: productRow.id,
              name: variant.name,
              attributes: variant.attributes,
              priceCents: variant.priceCents,
              isDefault: variant.isDefault,
              sortOrder: variant.sortOrder,
              updatedAt: new Date(),
            },
          })
          .returning({ id: productVariants.id });

        if (!variantRow) {
          throw new Error(`Failed to upsert variant "${variant.sku}"`);
        }

        const [stockRow] = await databaseService.db
          .insert(stockItems)
          .values({
            variantId: variantRow.id,
            quantity: variant.stock,
            reserved: 0,
          })
          .onConflictDoUpdate({
            target: stockItems.variantId,
            set: {
              quantity: variant.stock,
              updatedAt: new Date(),
            },
          })
          .returning({ quantity: stockItems.quantity, reserved: stockItems.reserved });

        if (stockRow && stockRow.quantity - stockRow.reserved > 0) {
          hasAvailableStock = true;
        }
      }

      // Project in_stock flag into catalog.products
      await databaseService.db
        .update(products)
        .set({ inStock: hasAvailableStock, updatedAt: new Date() })
        .where(eq(products.id, productRow.id));

      // Upload image via MediaService if present; leave products without image empty for fallback
      if (item.imageFile) {
        const imageBuffer = await readFile(resolve(fixtureDir, 'images', item.imageFile));
        const mediaResult = await mediaService.register({
          productId: productRow.id,
          buffer: imageBuffer,
          altText: item.name,
          isPrimary: true,
          position: 0,
        });

        if (mediaResult.deduplicated) {
          imagesDeduplicated += 1;
        } else {
          imagesUploaded += 1;
        }
      } else {
        productsWithoutImage += 1;
      }
    }

    // 4. Upsert default platform store_settings
    const defaultSettings = [
      {
        key: 'default_currency',
        value: 'BRL',
        description: 'Default storefront currency code (ISO-4217)',
      },
      {
        key: 'supported_currencies',
        value: ['BRL', 'USD', 'EUR'],
        description: 'Supported storefront currencies',
      },
    ];

    for (const setting of defaultSettings) {
      await databaseService.db
        .insert(storeSettings)
        .values(setting)
        .onConflictDoUpdate({
          target: storeSettings.key,
          set: {
            value: sql`excluded.value`,
            description: sql`excluded.description`,
            updatedAt: new Date(),
          },
        });
    }

    // 4.5 Upsert category complements from versioned JSON (R02)
    const rawComplements = await readFile(resolve(fixtureDir, 'category-complements.json'), 'utf8');
    const complementsFixture = JSON.parse(rawComplements) as {
      complements: Array<{
        categorySlug: string;
        complementCategorySlug: string;
        position: number;
      }>;
    };

    let categoryComplementsCount = 0;
    for (const rule of complementsFixture.complements) {
      const categoryId = categoryIdBySlug.get(rule.categorySlug);
      const complementCategoryId = categoryIdBySlug.get(rule.complementCategorySlug);
      if (!categoryId || !complementCategoryId) {
        throw new Error(
          `Missing category for complement rule "${rule.categorySlug}" -> "${rule.complementCategorySlug}"`,
        );
      }
      await databaseService.db
        .insert(categoryComplements)
        .values({
          categoryId,
          complementCategoryId,
          position: rule.position,
        })
        .onConflictDoUpdate({
          target: [categoryComplements.categoryId, categoryComplements.complementCategoryId],
          set: {
            position: rule.position,
            updatedAt: new Date(),
          },
        });
      categoryComplementsCount += 1;
    }

    // 4.6 Upsert curated manual relations from versioned JSON (R03)
    const rawManualRelations = await readFile(resolve(fixtureDir, 'manual-relations.json'), 'utf8');
    const manualRelationsFixture = JSON.parse(rawManualRelations) as {
      relations: Array<{
        productSlug: string;
        relatedProductSlug: string;
        type: 'related' | 'upsell' | 'cross_sell';
        position: number;
      }>;
    };

    const seededProductsForMap = await databaseService.db
      .select({ id: products.id, slug: products.slug })
      .from(products);
    const productIdBySlug = new Map(seededProductsForMap.map((p) => [p.slug, p.id]));

    let manualRelationsCount = 0;
    for (const rel of manualRelationsFixture.relations) {
      const productId = productIdBySlug.get(rel.productSlug);
      const relatedProductId = productIdBySlug.get(rel.relatedProductSlug);
      if (!productId || !relatedProductId) {
        throw new Error(
          `Missing product for manual relation "${rel.productSlug}" -> "${rel.relatedProductSlug}"`,
        );
      }

      await databaseService.db
        .insert(productRelations)
        .values({
          productId,
          relatedProductId,
          type: rel.type,
          source: 'manual',
          method: 'manual',
          score: null,
          position: rel.position,
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
            position: rel.position,
            updatedAt: new Date(),
          },
        });
      manualRelationsCount += 1;
    }

    // 5. Enqueue product.changed events in batch for outbox consumers (S05 / R03)
    const outboxService = new OutboxService(databaseService);
    const seededProductRows = seededProductsForMap;
    if (seededProductRows.length > 0) {
      await databaseService.db.transaction(async (tx) => {
        await outboxService.enqueueBatch(
          tx,
          seededProductRows.map((row) => ({
            eventType: 'product.changed' as const,
            aggregateType: 'product' as const,
            aggregateId: row.id,
            payload: { productId: row.id, cascade: false },
          })),
        );
      });
    }

    return {
      categoriesCount: fixture.categories.length,
      attributesCount: fixture.attributeDefinitions.length,
      productsCount: fixture.products.length,
      variantsCount,
      imagesUploaded,
      imagesDeduplicated,
      productsWithoutImage,
      categoryComplementsCount,
      manualRelationsCount,
    };
  } finally {
    if (ownsDb) {
      await databaseService.onModuleDestroy();
    }
  }
}

const isDirectRun =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runSeed()
    .then((summary) => {
      console.log('[seed] Completed:', JSON.stringify(summary));
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[seed] Failed: ${message}`);
      process.exit(1);
    });
}
