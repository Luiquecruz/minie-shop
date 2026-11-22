import { pgSchema, uuid, integer, timestamp, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { productVariants } from './catalog.js';

export const inventorySchema = pgSchema('inventory');

export const stockItems = inventorySchema.table(
  'stock_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    variantId: uuid('variant_id')
      .notNull()
      .unique()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(0),
    reserved: integer('reserved').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('stock_items_quantity_non_negative', sql`${table.quantity} >= 0`),
    check('stock_items_reserved_non_negative', sql`${table.reserved} >= 0`),
    check('stock_items_reserved_lte_quantity', sql`${table.reserved} <= ${table.quantity}`),
  ],
);
