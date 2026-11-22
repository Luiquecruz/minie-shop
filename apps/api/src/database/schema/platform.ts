import { pgSchema, uuid, text, jsonb, timestamp, check, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const platformSchema = pgSchema('platform');

export const storeSettings = platformSchema.table('store_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = platformSchema.table(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorType: text('actor_type').notNull(),
    actorId: uuid('actor_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('audit_log_actor_type_valid', sql`${table.actorType} IN ('system', 'customer', 'staff')`),
    index('audit_log_entity_idx').on(table.entityType, table.entityId),
    index('audit_log_created_idx').on(table.createdAt),
  ],
);
