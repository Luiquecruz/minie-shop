import { pgSchema, uuid, text, integer, jsonb, timestamp, check, index } from 'drizzle-orm/pg-core';
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
    beforeState: jsonb('before_state').$type<Record<string, unknown> | null>(),
    afterState: jsonb('after_state').$type<Record<string, unknown> | null>(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    requestId: text('request_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('audit_log_actor_type_valid', sql`${table.actorType} IN ('system', 'customer', 'staff')`),
    index('audit_log_entity_idx').on(table.entityType, table.entityId),
    index('audit_log_created_idx').on(table.createdAt),
    index('audit_log_actor_idx').on(table.actorType, table.actorId),
    index('audit_log_action_idx').on(table.action),
  ],
);

export const outbox = platformSchema.table(
  'outbox',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventType: text('event_type').notNull(),
    consumer: text('consumer').notNull(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    status: text('status').notNull().default('pending'),
  },
  (table) => [
    check('outbox_status_valid', sql`${table.status} IN ('pending', 'processed', 'dead')`),
    check('outbox_attempts_non_negative', sql`${table.attempts} >= 0`),
    index('outbox_polling_idx').on(table.status, table.availableAt, table.id),
  ],
);
