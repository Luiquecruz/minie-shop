import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { loadEnv } from '../config/env.js';
import * as schema from './schema/index.js';

export type DatabaseSchema = typeof schema;
export type DatabaseClient = NodePgDatabase<DatabaseSchema>;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;
  public readonly db: DatabaseClient;

  constructor() {
    const env = loadEnv();
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    this.db = drizzle(this.pool, { schema });
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
