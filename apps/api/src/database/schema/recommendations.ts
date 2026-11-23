import {
  pgSchema,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  check,
  index,
  unique,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { categories, products } from './catalog.js';

export const recommendationsSchema = pgSchema('recommendations');

export const productRelations = recommendationsSchema.table(
  'product_relations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    relatedProductId: uuid('related_product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    source: text('source').notNull(),
    method: text('method').notNull(),
    score: numeric('score', { precision: 6, scale: 5 }),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('product_relations_no_self', sql`${table.productId} <> ${table.relatedProductId}`),
    check('product_relations_type_valid', sql`${table.type} IN ('related', 'upsell', 'cross_sell')`),
    check('product_relations_source_valid', sql`${table.source} IN ('manual', 'auto')`),
    check('product_relations_method_valid', sql`${table.method} IN ('vector', 'rule', 'manual')`),
    check(
      'product_relations_source_method_score_valid',
      sql`(${table.source} = 'manual' AND ${table.method} = 'manual' AND ${table.score} IS NULL) OR (${table.source} = 'auto' AND ${table.method} IN ('vector', 'rule') AND ${table.score} IS NOT NULL)`,
    ),
    check('product_relations_position_non_negative', sql`${table.position} >= 0`),
    unique('product_relations_unique_triple').on(table.productId, table.relatedProductId, table.type),
    index('product_relations_lookup_idx').on(table.productId, table.type, table.position),
    index('product_relations_reverse_idx').on(table.relatedProductId),
  ],
);

export const categoryComplements = recommendationsSchema.table(
  'category_complements',
  {
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    complementCategoryId: uuid('complement_category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'category_complements_pk',
      columns: [table.categoryId, table.complementCategoryId],
    }),
    check(
      'category_complements_no_self',
      sql`${table.categoryId} <> ${table.complementCategoryId}`,
    ),
    check('category_complements_position_non_negative', sql`${table.position} >= 0`),
    index('category_complements_category_pos_idx').on(table.categoryId, table.position),
  ],
);
