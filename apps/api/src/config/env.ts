import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';

const booleanEnvSchema = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((value) => value === 'true' || value === '1');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL'),
  S3_ENDPOINT: z.string().url('S3_ENDPOINT must be a valid URL'),
  S3_PUBLIC_ENDPOINT: z.string().url('S3_PUBLIC_ENDPOINT must be a valid URL'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().min(1, 'S3_ACCESS_KEY_ID is required'),
  S3_SECRET_ACCESS_KEY: z.string().min(1, 'S3_SECRET_ACCESS_KEY is required'),
  S3_PUBLIC_BUCKET: z.string().min(1, 'S3_PUBLIC_BUCKET is required'),
  S3_PRIVATE_BUCKET: z.string().min(1, 'S3_PRIVATE_BUCKET is required'),
  CORS_ORIGINS: z.string().default('http://localhost:5199'),
  COOKIE_SECRET: z
    .string()
    .min(16, 'COOKIE_SECRET must be at least 16 characters')
    .default('minieshop-dev-cookie-secret-change-me'),
  CHAOS_ENABLED: booleanEnvSchema,
  MEILI_HOST: z.string().url('MEILI_HOST must be a valid URL').default('http://localhost:7700'),
  MEILI_API_KEY: z.string().optional(),
  MEILI_API_KEY_FILE: z.string().optional(),
  MEILI_MASTER_KEY: z.string().optional(),
  MEILI_INDEX_PRODUCTS: z.string().min(1).default('products'),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(50).max(60_000).default(500),
  WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(200).default(20),
  WORKER_LEASE_MS: z.coerce.number().int().min(1_000).max(600_000).default(30_000),
  WORKER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(50).default(5),
  OUTBOX_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(7),
  EMBEDDINGS_PROVIDER: z.enum(['ollama', 'fake']).default('ollama'),
  EMBEDDINGS_BASE_URL: z.string().url().default('http://localhost:11434'),
  EMBEDDINGS_MODEL: z.string().min(1).default('embeddinggemma'),
  EMBEDDINGS_DIMENSIONS: z.coerce.number().int().min(1).max(4096).default(768),
  EMBEDDINGS_QUERY_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(4_000),
  MEILI_EMBEDDER_NAME: z.string().min(1).default('semantic'),
  SEARCH_SEMANTIC_RATIO: z.coerce.number().min(0).max(1).default(0.5),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function resetEnvCache(): void {
  cachedEnv = null;
}

export function resolveMeiliApiKey(env: Pick<Env, 'MEILI_API_KEY' | 'MEILI_API_KEY_FILE' | 'MEILI_MASTER_KEY'>): string {
  if (env.MEILI_API_KEY_FILE && existsSync(env.MEILI_API_KEY_FILE)) {
    const fileValue = readFileSync(env.MEILI_API_KEY_FILE, 'utf8').trim();
    if (fileValue.length > 0) {
      return fileValue;
    }
  }
  if (env.MEILI_API_KEY && env.MEILI_API_KEY.trim().length > 0) {
    return env.MEILI_API_KEY.trim();
  }
  if (env.MEILI_MASTER_KEY && env.MEILI_MASTER_KEY.trim().length > 0) {
    return env.MEILI_MASTER_KEY.trim();
  }
  return '';
}

export function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  if (cachedEnv && raw === process.env) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'ENV'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  if (raw === process.env) {
    cachedEnv = parsed.data;
  }

  return parsed.data;
}
