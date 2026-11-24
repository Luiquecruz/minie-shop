import {
  pgSchema,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  numeric,
  jsonb,
  timestamp,
  check,
  index,
  uniqueIndex,
  vector,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { mediaAssets } from './media.js';
import { customers } from './identity.js';

export const catalogSchema = pgSchema('catalog');

export const categories = catalogSchema.table(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'set null',
    }),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('categories_parent_idx').on(table.parentId)],
);

export const attributeDefinitions = catalogSchema.table(
  'attribute_definitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull().unique(),
    label: text('label').notNull(),
    dataType: text('data_type').notNull(),
    unit: text('unit'),
    isFilterable: boolean('is_filterable').notNull().default(false),
    showOnCard: boolean('show_on_card').notNull().default(false),
    iconKey: text('icon_key'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'attribute_definitions_data_type_valid',
      sql`${table.dataType} IN ('string', 'number', 'boolean', 'enum')`,
    ),
  ],
);

export const products = catalogSchema.table(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    slug: text('slug').notNull().unique(),
    sku: text('sku').notNull().unique(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    regularPriceCents: integer('regular_price_cents').notNull(),
    specialPriceCents: integer('special_price_cents'),
    currency: varchar('currency', { length: 3 }).notNull().default('BRL'),
    inStock: boolean('in_stock').notNull().default(false),
    status: text('status').notNull().default('published'),
    ratingAverage: numeric('rating_average', { precision: 3, scale: 2 }).notNull().default('0.00'),
    ratingCount: integer('rating_count').notNull().default(0),
    attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('products_regular_price_non_negative', sql`${table.regularPriceCents} >= 0`),
    check(
      'products_special_price_valid',
      sql`${table.specialPriceCents} IS NULL OR (${table.specialPriceCents} >= 0 AND ${table.specialPriceCents} <= ${table.regularPriceCents})`,
    ),
    check('products_rating_count_non_negative', sql`${table.ratingCount} >= 0`),
    check('products_status_valid', sql`${table.status} IN ('draft', 'published', 'archived')`),
    check('products_slug_not_reserved', sql`${table.slug} <> 'facets'`),
    check('products_base_currency_brl', sql`${table.currency} = 'BRL'`),
    index('products_category_idx').on(table.categoryId),
    index('products_status_idx').on(table.status),
    index('products_regular_price_idx').on(table.regularPriceCents),
    index('products_special_price_idx').on(table.specialPriceCents),
    index('products_attributes_gin_idx').using('gin', table.attributes),
  ],
);

export const productVariants = catalogSchema.table(
  'product_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull().unique(),
    name: text('name').notNull(),
    attributes: jsonb('attributes').$type<Record<string, string>>().notNull().default({}),
    priceCents: integer('price_cents'),
    isDefault: boolean('is_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'product_variants_price_non_negative',
      sql`${table.priceCents} IS NULL OR ${table.priceCents} >= 0`,
    ),
    index('product_variants_product_idx').on(table.productId),
  ],
);

export const productImages = catalogSchema.table(
  'product_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    altText: text('alt_text').notNull().default(''),
    position: integer('position').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('product_images_position_non_negative', sql`${table.position} >= 0`),
    uniqueIndex('product_images_product_media_uidx').on(table.productId, table.mediaAssetId),
    index('product_images_product_idx').on(table.productId),
  ],
);

export const favorites = catalogSchema.table(
  'favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'favorites_owner_present',
      sql`${table.customerId} IS NOT NULL OR ${table.sessionId} IS NOT NULL`,
    ),
  ],
);

export const productEmbeddings = catalogSchema.table(
  'product_embeddings',
  {
    productId: uuid('product_id')
      .primaryKey()
      .references(() => products.id, { onDelete: 'cascade' }),
    embedding: vector('embedding', { dimensions: 768 }).notNull(),
    model: text('model').notNull(),
    contentHash: text('content_hash').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('product_embeddings_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops'))],
);

export const productPrices = catalogSchema.table(
  'product_prices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    currency: varchar('currency', { length: 3 }).notNull(),
    regularPriceCents: integer('regular_price_cents').notNull(),
    specialPriceCents: integer('special_price_cents'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('product_prices_currency_valid', sql`${table.currency} IN ('USD', 'EUR')`),
    check('product_prices_regular_non_negative', sql`${table.regularPriceCents} >= 0`),
    check(
      'product_prices_special_valid',
      sql`${table.specialPriceCents} IS NULL OR (${table.specialPriceCents} >= 0 AND ${table.specialPriceCents} <= ${table.regularPriceCents})`,
    ),
    uniqueIndex('product_prices_product_currency_uidx').on(table.productId, table.currency),
    index('product_prices_currency_idx').on(table.currency),
  ],
);

export const exchangeRates = catalogSchema.table(
  'exchange_rates',
  {
    currency: varchar('currency', { length: 3 }).primaryKey(),
    rateFromBrl: numeric('rate_from_brl', { precision: 12, scale: 6 }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('exchange_rates_currency_valid', sql`${table.currency} IN ('BRL', 'USD', 'EUR')`),
    check('exchange_rates_positive', sql`${table.rateFromBrl} > 0`),
  ],
);
