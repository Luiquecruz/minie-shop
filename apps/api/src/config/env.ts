import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';

const booleanEnvSchema = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((value) => value === 'true' || value === '1');

export const DEV_DEFAULT_COOKIE_SECRET = 'minieshop-dev-cookie-secret-change-me';
export const DEV_DEFAULT_CSRF_SECRET = 'minieshop-dev-csrf-secret-change-me-32chars';
export const DEV_DEFAULT_EMAIL_TOKEN_SECRET = 'minieshop-dev-email-token-secret-change-me';
export const DEV_DEFAULT_ADMIN_EMAIL = 'admin@minieshop.local';
export const DEV_DEFAULT_ADMIN_PASSWORD = 'minieshop-dev-admin-pass-2026';

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
  STOREFRONT_URL: z.string().url('STOREFRONT_URL must be a valid URL').default('http://localhost:5199'),
  COOKIE_SECRET: z
    .string()
    .min(16, 'COOKIE_SECRET must be at least 16 characters')
    .default(DEV_DEFAULT_COOKIE_SECRET),
  COOKIE_SECURE: booleanEnvSchema,
  CSRF_SECRET: z
    .string()
    .min(32, 'CSRF_SECRET must be at least 32 characters')
    .default(DEV_DEFAULT_CSRF_SECRET),
  EMAIL_TOKEN_SECRET: z
    .string()
    .min(32, 'EMAIL_TOKEN_SECRET must be at least 32 characters')
    .default(DEV_DEFAULT_EMAIL_TOKEN_SECRET),
  TRUST_PROXY: booleanEnvSchema,
  CUSTOMER_SESSION_IDLE_TTL_SECONDS: z.coerce.number().int().min(60).default(7 * 24 * 60 * 60),
  CUSTOMER_SESSION_ABSOLUTE_TTL_SECONDS: z.coerce.number().int().min(60).default(30 * 24 * 60 * 60),
  STAFF_SESSION_IDLE_TTL_SECONDS: z.coerce.number().int().min(60).default(30 * 60),
  STAFF_SESSION_ABSOLUTE_TTL_SECONDS: z.coerce.number().int().min(60).default(8 * 60 * 60),
  SESSION_TOUCH_THRESHOLD_SECONDS: z.coerce.number().int().min(0).default(300),
  SESSION_CLEANUP_INTERVAL_MS: z.coerce.number().int().min(1_000).default(15 * 60 * 1_000),
  ARGON2_MEMORY_COST: z.coerce.number().int().min(1024).max(1_048_576).default(19_456),
  ARGON2_TIME_COST: z.coerce.number().int().min(1).max(20).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).max(16).default(1),
  MAIL_TRANSPORT: z.enum(['smtp', 'resend', 'memory']).default('smtp'),
  MAIL_FROM: z.string().min(1).default('Progressive Minie Shop <no-reply@minieshop.local>'),
  SMTP_HOST: z.string().min(1).default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  ADMIN_EMAIL: z.string().default(DEV_DEFAULT_ADMIN_EMAIL),
  ADMIN_PASSWORD: z.string().default(DEV_DEFAULT_ADMIN_PASSWORD),
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
  RECOMMENDATIONS_RELATED_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.45),
  RECOMMENDATIONS_UPSELL_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.5),
  RECOMMENDATIONS_UPSELL_MIN_RATIO: z.coerce.number().positive().default(1.1),
  RECOMMENDATIONS_UPSELL_MAX_RATIO: z.coerce.number().positive().default(2.5),
  RECOMMENDATIONS_CROSS_SELL_MAX_PER_CATEGORY: z.coerce.number().int().min(1).max(12).default(2),
  RECOMMENDATIONS_REVERSE_FANOUT_LIMIT: z.coerce.number().int().min(0).max(200).default(20),
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

export function assertSecurityConfig(env: Env): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  const errors: string[] = [];

  if (!env.COOKIE_SECURE) {
    errors.push('COOKIE_SECURE must be true in production');
  }
  if (env.COOKIE_SECRET.length < 32 || env.COOKIE_SECRET === DEV_DEFAULT_COOKIE_SECRET) {
    errors.push('COOKIE_SECRET must be a strong non-default secret (>= 32 chars) in production');
  }
  if (env.CSRF_SECRET.length < 32 || env.CSRF_SECRET === DEV_DEFAULT_CSRF_SECRET) {
    errors.push('CSRF_SECRET must be a strong non-default secret (>= 32 chars) in production');
  }
  if (
    env.EMAIL_TOKEN_SECRET.length < 32 ||
    env.EMAIL_TOKEN_SECRET === DEV_DEFAULT_EMAIL_TOKEN_SECRET
  ) {
    errors.push(
      'EMAIL_TOKEN_SECRET must be a strong non-default secret (>= 32 chars) in production',
    );
  }
  if (env.MAIL_TRANSPORT === 'memory') {
    errors.push('MAIL_TRANSPORT=memory is forbidden in production');
  }
  if (env.MAIL_FROM.trim().length === 0) {
    errors.push('MAIL_FROM is required in production');
  }
  if (env.MAIL_TRANSPORT === 'resend' && (!env.RESEND_API_KEY || env.RESEND_API_KEY.trim().length === 0)) {
    errors.push('RESEND_API_KEY is required in production when MAIL_TRANSPORT=resend');
  }
  if (!env.ADMIN_EMAIL.trim() || env.ADMIN_EMAIL.trim().toLowerCase() === DEV_DEFAULT_ADMIN_EMAIL) {
    errors.push('ADMIN_EMAIL must not use the dev default or be empty in production');
  }
  if (
    !env.ADMIN_PASSWORD ||
    env.ADMIN_PASSWORD.length < 12 ||
    env.ADMIN_PASSWORD === DEV_DEFAULT_ADMIN_PASSWORD
  ) {
    errors.push('ADMIN_PASSWORD must be a strong non-default password (>= 12 chars) in production');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid production security configuration:\n  - ${errors.join('\n  - ')}`);
  }
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
