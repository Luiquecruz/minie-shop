import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { loadEnv } from '../config/env.js';

async function runMigrations(): Promise<void> {
  const env = loadEnv();
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    await db.execute(sql`SELECT 1`);
    const migrationsFolder = resolve(process.cwd(), 'drizzle');

    if (existsSync(resolve(migrationsFolder, 'meta/_journal.json'))) {
      console.log(`[migrate] Applying Drizzle migrations from ${migrationsFolder}...`);
      await migrate(db, { migrationsFolder });
      console.log('[migrate] Migrations applied successfully.');
    } else {
      console.log('[migrate] No Drizzle migrations found yet; database connectivity verified.');
    }
  } finally {
    await pool.end();
  }
}

runMigrations().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[migrate] Failed: ${message}`);
  process.exit(1);
});
