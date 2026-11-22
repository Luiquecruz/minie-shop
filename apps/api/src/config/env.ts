import { z } from 'zod';

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
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

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
