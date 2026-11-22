import type { FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import type { Env } from '../config/env.js';
import { buildErrorResponse } from './global-exception.filter.js';

const MAX_CHAOS_DELAY_MS = 10_000;
const CHAOS_EXEMPT_PATHS = new Set(['/health', '/ready']);

export function assertChaosSafety(env: Pick<Env, 'NODE_ENV' | 'CHAOS_ENABLED'>): void {
  if (env.NODE_ENV === 'production' && env.CHAOS_ENABLED) {
    throw new Error(
      'CHAOS_ENABLED=true is forbidden when NODE_ENV=production. Disable CHAOS_ENABLED before booting in production.',
    );
  }
}

export function parseChaosDelayMs(raw: string, randomFn: () => number = Math.random): number | null {
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) {
    return Math.min(MAX_CHAOS_DELAY_MS, Number(trimmed));
  }

  const rangeMatch = /^(\d+)-(\d+)$/.exec(trimmed);
  if (!rangeMatch) {
    return null;
  }

  const min = Math.min(MAX_CHAOS_DELAY_MS, Number(rangeMatch[1]));
  const max = Math.min(MAX_CHAOS_DELAY_MS, Number(rangeMatch[2]));
  if (max < min) {
    return null;
  }

  return min + Math.floor(randomFn() * (max - min + 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function registerChaosHook(
  fastify: FastifyInstance,
  env: Pick<Env, 'NODE_ENV' | 'CHAOS_ENABLED'>,
  logger: Pick<Logger, 'warn'>,
): boolean {
  assertChaosSafety(env);

  if (!env.CHAOS_ENABLED) {
    return false;
  }

  logger.warn(
    { chaosEnabled: true, nodeEnv: env.NODE_ENV },
    'Chaos middleware is ENABLED (non-production only). Headers x-chaos-delay, x-chaos-fail, x-chaos-status are active.',
  );

  fastify.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') {
      return;
    }

    const pathname = request.url.split('?')[0] ?? request.url;
    if (CHAOS_EXEMPT_PATHS.has(pathname)) {
      return;
    }

    const delayHeader = request.headers['x-chaos-delay'];
    if (typeof delayHeader === 'string' && delayHeader.trim().length > 0) {
      const delayMs = parseChaosDelayMs(delayHeader);
      if (delayMs !== null && delayMs > 0) {
        await sleep(delayMs);
      }
    }

    const requestId = typeof request.id === 'string' ? request.id : String(request.id ?? 'unknown');

    const statusHeader = request.headers['x-chaos-status'];
    if (typeof statusHeader === 'string' && /^\d{3}$/.test(statusHeader.trim())) {
      const forcedStatus = Number(statusHeader.trim());
      if (forcedStatus >= 400 && forcedStatus <= 599) {
        const payload = buildErrorResponse({
          code: 'CHAOS_FAILURE',
          message: `Simulated chaos HTTP status ${forcedStatus}`,
          requestId,
        });
        await reply.code(forcedStatus).send(payload);
        return reply;
      }
    }

    const failHeader = request.headers['x-chaos-fail'];
    if (typeof failHeader === 'string' && failHeader.trim().length > 0) {
      const probability = Number(failHeader.trim());
      if (!Number.isNaN(probability) && probability > 0) {
        const clamped = Math.min(1, probability);
        if (clamped >= 1 || Math.random() < clamped) {
          const payload = buildErrorResponse({
            code: 'CHAOS_FAILURE',
            message: 'Simulated chaos failure',
            requestId,
          });
          await reply.code(503).send(payload);
          return reply;
        }
      }
    }
  });

  return true;
}
