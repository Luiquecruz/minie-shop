import { pgSchema, uuid, text, integer, jsonb, timestamp, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const mediaSchema = pgSchema('media');

export interface MediaVariantInfo {
  key: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
}

export interface MediaVariantsMap {
  thumb?: MediaVariantInfo;
  card?: MediaVariantInfo;
  detail?: MediaVariantInfo;
}

export const mediaAssets = mediaSchema.table(
  'media_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storageKey: text('storage_key').notNull().unique(),
    bucket: text('bucket').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    checksumSha256: text('checksum_sha256').notNull().unique(),
    placeholderBase64: text('placeholder_base64'),
    variants: jsonb('variants').$type<MediaVariantsMap>().notNull().default({}),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('media_assets_size_positive', sql`${table.sizeBytes} > 0`),
    check(
      'media_assets_dimensions_positive',
      sql`(${table.width} IS NULL OR ${table.width} > 0) AND (${table.height} IS NULL OR ${table.height} > 0)`,
    ),
    check('media_assets_status_valid', sql`${table.status} IN ('pending', 'ready', 'failed')`),
  ],
);
