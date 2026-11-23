import { Inject, Injectable, Optional } from '@nestjs/common';
import { CLOCK_TOKEN, SystemClock, type Clock } from '../../common/clock.js';
import { rateLimitedError } from '../../common/errors.js';

export const RATE_LIMITER_TOKEN = Symbol('RATE_LIMITER_TOKEN');

export interface RateLimitRule {
  /** Max attempts allowed inside windowSeconds before triggering backoff */
  maxAttempts: number;
  /** Sliding window size in seconds */
  windowSeconds: number;
  /** Base block duration in seconds on first violation */
  baseBlockSeconds: number;
  /** Upper bound for progressive backoff in seconds (never permanent lockout) */
  maxBlockSeconds: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export interface RateLimiter {
  consume(key: string, rule: RateLimitRule): Promise<RateLimitDecision>;
  reset(key: string): Promise<void>;
  clearAll(): void;
}

export const RATE_LIMIT_RULES = {
  LOGIN_ACCOUNT: {
    maxAttempts: 5,
    windowSeconds: 15 * 60,
    baseBlockSeconds: 30,
    maxBlockSeconds: 15 * 60,
  },
  LOGIN_IP: {
    maxAttempts: 20,
    windowSeconds: 15 * 60,
    baseBlockSeconds: 30,
    maxBlockSeconds: 15 * 60,
  },
  STAFF_LOGIN_ACCOUNT: {
    maxAttempts: 5,
    windowSeconds: 15 * 60,
    baseBlockSeconds: 60,
    maxBlockSeconds: 30 * 60,
  },
  STAFF_LOGIN_IP: {
    maxAttempts: 15,
    windowSeconds: 15 * 60,
    baseBlockSeconds: 60,
    maxBlockSeconds: 30 * 60,
  },
  REGISTER_IP: {
    maxAttempts: 10,
    windowSeconds: 60 * 60,
    baseBlockSeconds: 60,
    maxBlockSeconds: 30 * 60,
  },
  FORGOT_PASSWORD_ACCOUNT: {
    maxAttempts: 3,
    windowSeconds: 15 * 60,
    baseBlockSeconds: 60,
    maxBlockSeconds: 30 * 60,
  },
  FORGOT_PASSWORD_IP: {
    maxAttempts: 15,
    windowSeconds: 15 * 60,
    baseBlockSeconds: 60,
    maxBlockSeconds: 30 * 60,
  },
  RESEND_VERIFICATION_ACCOUNT: {
    maxAttempts: 3,
    windowSeconds: 15 * 60,
    baseBlockSeconds: 60,
    maxBlockSeconds: 30 * 60,
  },
  RESEND_VERIFICATION_IP: {
    maxAttempts: 15,
    windowSeconds: 15 * 60,
    baseBlockSeconds: 60,
    maxBlockSeconds: 30 * 60,
  },
} as const satisfies Record<string, RateLimitRule>;

interface BucketEntry {
  timestamps: number[];
  violations: number;
  blockedUntilMs: number;
}

@Injectable()
export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, BucketEntry>();
  private readonly clock: Clock;

  constructor(
    @Optional()
    @Inject(CLOCK_TOKEN)
    clock?: Clock,
  ) {
    this.clock = clock ?? new SystemClock();
  }

  async consume(key: string, rule: RateLimitRule): Promise<RateLimitDecision> {
    const nowMs = this.clock.now().getTime();
    const windowMs = rule.windowSeconds * 1000;

    let entry = this.buckets.get(key);
    if (!entry) {
      entry = { timestamps: [], violations: 0, blockedUntilMs: 0 };
      this.buckets.set(key, entry);
    }

    if (entry.blockedUntilMs > nowMs) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.blockedUntilMs - nowMs) / 1000));
      return { allowed: false, retryAfterSeconds, remaining: 0 };
    }

    // Evict timestamps outside the sliding window
    entry.timestamps = entry.timestamps.filter((ts) => nowMs - ts < windowMs);

    if (entry.timestamps.length >= rule.maxAttempts) {
      entry.violations += 1;
      const backoffSeconds = Math.min(
        rule.maxBlockSeconds,
        rule.baseBlockSeconds * 2 ** (entry.violations - 1),
      );
      entry.blockedUntilMs = nowMs + backoffSeconds * 1000;
      return { allowed: false, retryAfterSeconds: backoffSeconds, remaining: 0 };
    }

    entry.timestamps.push(nowMs);
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(0, rule.maxAttempts - entry.timestamps.length),
    };
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  clearAll(): void {
    this.buckets.clear();
  }
}

export async function enforceRateLimit(
  limiter: RateLimiter,
  checks: ReadonlyArray<{ key: string; rule: RateLimitRule }>,
): Promise<void> {
  let maxRetryAfter = 0;
  for (const check of checks) {
    const decision = await limiter.consume(check.key, check.rule);
    if (!decision.allowed && decision.retryAfterSeconds > maxRetryAfter) {
      maxRetryAfter = decision.retryAfterSeconds;
    }
  }
  if (maxRetryAfter > 0) {
    throw rateLimitedError(maxRetryAfter);
  }
}
