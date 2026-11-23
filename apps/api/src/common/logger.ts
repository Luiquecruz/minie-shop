import { pino, type DestinationStream, type Logger } from 'pino';
import type { Env } from '../config/env.js';

export const REDACTED_PLACEHOLDER = '[REDACTED]';

export const PINO_REDACT_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'headers["x-csrf-token"]',
  'password',
  'currentPassword',
  'newPassword',
  'passwordHash',
  'password_hash',
  'token',
  'rawToken',
  'tokenHash',
  'token_hash',
  'secret',
  'csrfToken',
  'cookie',
  'authorization',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.passwordHash',
  '*.password_hash',
  '*.token',
  '*.rawToken',
  '*.tokenHash',
  '*.token_hash',
  '*.secret',
  '*.csrfToken',
  '*.cookie',
  '*.authorization',
  '*.*.password',
  '*.*.passwordHash',
  '*.*.token',
  '*.*.tokenHash',
  '*.*.secret',
  '*.*.cookie',
  '*.*.authorization',
];

const SENSITIVE_KEY_PATTERN = /(password|passwd|token|hash|secret|authorization|cookie|csrf|api[-_]?key)/i;

export function redactSensitiveData<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item)) as unknown as T;
  }
  if (typeof value === 'object' && !(value instanceof Date)) {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = REDACTED_PLACEHOLDER;
      } else {
        output[key] = redactSensitiveData(entry);
      }
    }
    return output as T;
  }
  return value;
}

export function createAppLogger(
  env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>,
  service: string,
  destination?: DestinationStream,
): Logger {
  const options = {
    level: env.LOG_LEVEL,
    base: { service, env: env.NODE_ENV },
    redact: {
      paths: PINO_REDACT_PATHS,
      censor: REDACTED_PLACEHOLDER,
    },
  };

  return destination ? pino(options, destination) : pino(options);
}
