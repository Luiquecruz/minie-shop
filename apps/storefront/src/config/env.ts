import { z } from 'zod';

const storefrontEnvSchema = z.object({
  VITE_API_URL: z
    .string({
      required_error:
        'Missing required environment variable VITE_API_URL (e.g. http://localhost:3001).',
    })
    .trim()
    .min(1, 'VITE_API_URL cannot be empty.')
    .url('VITE_API_URL must be a valid HTTP(S) URL (e.g. http://localhost:3001).')
    .refine(
      (value) => value.startsWith('http://') || value.startsWith('https://'),
      'VITE_API_URL must use http:// or https:// protocol.',
    )
    .transform((value) => value.replace(/\/+$/, '')),
});

export type StorefrontEnv = z.infer<typeof storefrontEnvSchema>;

/**
 * Parses and validates storefront environment variables at boot time.
 * Fails fast with a clear, actionable message if configuration is invalid.
 */
export function parseStorefrontEnv(
  rawEnv: Record<string, unknown>,
  options?: { allowTestDefault?: boolean },
): StorefrontEnv {
  const input: Record<string, unknown> = {
    VITE_API_URL: rawEnv.VITE_API_URL,
  };

  if (
    (input.VITE_API_URL === undefined || input.VITE_API_URL === '') &&
    options?.allowTestDefault
  ) {
    input.VITE_API_URL = 'http://localhost:3001';
  }

  const parsed = storefrontEnvSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`[StorefrontEnv] Invalid environment configuration: ${details}`);
  }

  return parsed.data;
}

let cachedEnv: StorefrontEnv | null = null;

export function getStorefrontEnv(): StorefrontEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const metaEnv = import.meta.env as Record<string, unknown>;
  const isTestOrDevFallback = metaEnv.MODE === 'test';
  cachedEnv = parseStorefrontEnv(metaEnv, {
    allowTestDefault: isTestOrDevFallback,
  });
  return cachedEnv;
}
