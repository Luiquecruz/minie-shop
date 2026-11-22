import { randomUUID } from 'node:crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema/index.js';
import {
  attributeDefinitions,
  categories,
  mediaAssets,
  productImages,
  products,
  type MediaVariantsMap,
} from '../database/schema/index.js';

export type TestDb = NodePgDatabase<typeof schema>;

let seq = 1;
function nextSeq(): number {
  return seq++;
}

export async function createCategory(
  db: TestDb,
  overrides: {
    slug?: string;
    name?: string;
    parentId?: string | null;
    sortOrder?: number;
  } = {},
): Promise<{ id: string; slug: string; name: string; parentId: string | null }> {
  const n = nextSeq();
  const [row] = await db
    .insert(categories)
    .values({
      slug: overrides.slug ?? `category-${n}`,
      name: overrides.name ?? `Category ${n}`,
      parentId: overrides.parentId ?? null,
      sortOrder: overrides.sortOrder ?? n,
    })
    .returning({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      parentId: categories.parentId,
    });

  if (!row) {
    throw new Error('Failed to insert test category');
  }
  return row;
}

export async function createAttributeDefinition(
  db: TestDb,
  overrides: {
    code: string;
    label: string;
    dataType: 'string' | 'number' | 'boolean' | 'enum';
    unit?: string | null;
    isFilterable?: boolean;
    showOnCard?: boolean;
    iconKey?: string | null;
    sortOrder?: number;
  },
): Promise<{ id: string; code: string }> {
  const n = nextSeq();
  const [row] = await db
    .insert(attributeDefinitions)
    .values({
      code: overrides.code,
      label: overrides.label,
      dataType: overrides.dataType,
      unit: overrides.unit ?? null,
      isFilterable: overrides.isFilterable ?? true,
      showOnCard: overrides.showOnCard ?? false,
      iconKey: overrides.iconKey ?? null,
      sortOrder: overrides.sortOrder ?? n,
    })
    .returning({ id: attributeDefinitions.id, code: attributeDefinitions.code });

  if (!row) {
    throw new Error('Failed to insert test attribute definition');
  }
  return row;
}

export async function createProduct(
  db: TestDb,
  overrides: {
    categoryId: string;
    slug?: string;
    sku?: string;
    name?: string;
    description?: string;
    regularPriceCents?: number;
    specialPriceCents?: number | null;
    currency?: string;
    inStock?: boolean;
    status?: 'draft' | 'published' | 'archived';
    attributes?: Record<string, unknown>;
    createdAt?: Date;
  },
): Promise<{ id: string; slug: string; name: string; effectivePrice: number }> {
  const n = nextSeq();
  const regularPriceCents = overrides.regularPriceCents ?? 10000;
  const specialPriceCents = overrides.specialPriceCents ?? null;

  const [row] = await db
    .insert(products)
    .values({
      categoryId: overrides.categoryId,
      slug: overrides.slug ?? `product-${n}`,
      sku: overrides.sku ?? `SKU-${n}-${randomUUID().slice(0, 6)}`,
      name: overrides.name ?? `Product ${n}`,
      description: overrides.description ?? `Description for product ${n}`,
      regularPriceCents,
      specialPriceCents,
      currency: overrides.currency ?? 'BRL',
      inStock: overrides.inStock ?? true,
      status: overrides.status ?? 'published',
      attributes: overrides.attributes ?? {},
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    })
    .returning({
      id: products.id,
      slug: products.slug,
      name: products.name,
    });

  if (!row) {
    throw new Error('Failed to insert test product');
  }

  return {
    ...row,
    effectivePrice: specialPriceCents ?? regularPriceCents,
  };
}

export async function createProductImageWithAsset(
  db: TestDb,
  params: {
    productId: string;
    status?: 'ready' | 'pending' | 'failed';
    altText?: string;
    isPrimary?: boolean;
    position?: number;
    width?: number;
    height?: number;
  },
): Promise<{ assetId: string }> {
  const assetUuid = randomUUID();
  const basePrefix = `products/${params.productId}/${assetUuid}`;
  const status = params.status ?? 'ready';
  const variants: MediaVariantsMap =
    status === 'ready'
      ? {
          detail: {
            key: `${basePrefix}/detail.webp`,
            width: 1200,
            height: 800,
            sizeBytes: 50_000,
            mimeType: 'image/webp',
          },
          thumb: {
            key: `${basePrefix}/thumb.webp`,
            width: 200,
            height: 133,
            sizeBytes: 5_000,
            mimeType: 'image/webp',
          },
          card: {
            key: `${basePrefix}/card.webp`,
            width: 600,
            height: 400,
            sizeBytes: 20_000,
            mimeType: 'image/webp',
          },
        }
      : {};

  const [asset] = await db
    .insert(mediaAssets)
    .values({
      storageKey: `${basePrefix}/original.jpg`,
      bucket: 'minieshop-catalog-public',
      mimeType: 'image/jpeg',
      sizeBytes: 100_000,
      width: params.width ?? 1200,
      height: params.height ?? 800,
      checksumSha256: randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, ''),
      placeholderBase64: status === 'ready' ? 'data:image/webp;base64,UklGRh4AAABXRUJQ' : null,
      variants,
      status,
    })
    .returning({ id: mediaAssets.id });

  if (!asset) {
    throw new Error('Failed to insert test media asset');
  }

  await db.insert(productImages).values({
    productId: params.productId,
    mediaAssetId: asset.id,
    altText: params.altText ?? 'Product image',
    position: params.position ?? 0,
    isPrimary: params.isPrimary ?? true,
  });

  return { assetId: asset.id };
}
