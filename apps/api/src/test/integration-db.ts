import { resolve } from 'node:path';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from '../database/schema/index.js';

export const DEFAULT_TEST_DATABASE_URL =
  'postgresql://minieshop:minieshop_dev_password@localhost:5432/app_test';

export function getTestDatabaseUrl(): string {
  const configured = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!configured) {
    return DEFAULT_TEST_DATABASE_URL;
  }

  const parsed = new URL(configured);
  if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname === '/minieshop') {
    parsed.pathname = '/app_test';
  }
  return parsed.toString();
}

export async function ensureTestDatabaseReady(databaseUrl: string): Promise<void> {
  const targetUrl = new URL(databaseUrl);
  const dbName = targetUrl.pathname.replace(/^\//, '');
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error(`Unsafe test database name: "${dbName}"`);
  }

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';

  const adminPool = new Pool({ connectionString: adminUrl.toString() });
  try {
    const existsRes = await adminPool.query<{ exists: number }>(
      'SELECT 1 AS exists FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (existsRes.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await adminPool.end();
  }

  const migrationPool = new Pool({ connectionString: databaseUrl });
  try {
    const db = drizzle(migrationPool);
    const migrationsFolder = resolve(process.cwd(), 'drizzle');
    await migrate(db, { migrationsFolder });
  } finally {
    await migrationPool.end();
  }
}

export async function truncateCatalogAndMedia(db: NodePgDatabase<typeof schema>): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE
      "catalog"."favorites",
      "catalog"."product_images",
      "catalog"."product_variants",
      "catalog"."products",
      "catalog"."attribute_definitions",
      "catalog"."categories",
      "media"."media_assets"
      RESTART IDENTITY CASCADE`,
  );
}
