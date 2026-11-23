import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Writable } from 'node:stream';
import { createAppLogger, redactSensitiveData } from '../../common/logger.js';
import {
  assertSecurityConfig,
  DEV_DEFAULT_COOKIE_SECRET,
  loadEnv,
  resetEnvCache,
} from '../../config/env.js';
import { CsrfService } from './csrf.service.js';
import { PasswordService } from './password.service.js';
import { InMemoryRateLimiter, RATE_LIMIT_RULES, enforceRateLimit } from './rate-limiter.js';
import { getSessionCookieName, hashSessionToken } from './session.service.js';
import type { Clock } from '../../common/clock.js';

class FakeClock implements Clock {
  constructor(private currentMs: number) {}
  now(): Date {
    return new Date(this.currentMs);
  }
  advanceMs(ms: number): void {
    this.currentMs += ms;
  }
}

describe('I01 — Password Policy, Argon2id, CSRF, RateLimiter & Log Redaction', () => {
  it('enforces password length (12..128), NFKC normalization, common password & email rejection', () => {
    const pwd = new PasswordService();

    const expectPasswordDetail = (fn: () => unknown, pattern: RegExp) => {
      assert.throws(fn, (err: unknown) => {
        const e = err as { code?: string; details?: Array<{ message: string }> };
        return e.code === 'VALIDATION_ERROR' && pattern.test(e.details?.[0]?.message ?? '');
      });
    };

    expectPasswordDetail(() => pwd.validatePolicy('short12345'), /at least 12/);
    expectPasswordDetail(() => pwd.validatePolicy('a'.repeat(129)), /at most 128/);
    expectPasswordDetail(() => pwd.validatePolicy('password1234'), /too common/);
    expectPasswordDetail(() => pwd.validatePolicy('minhasenha123'), /too common/);
    expectPasswordDetail(
      () => pwd.validatePolicy('alice@example.com', 'alice@example.com'),
      /identical to the email/,
    );

    // NFKC normalizes fullwidth characters into ASCII; common password in fullwidth is still caught
    expectPasswordDetail(() => pwd.validatePolicy('ｐａｓｓｗｏｒｄ１２３４'), /too common/);

    // Valid passphrase without arbitrary composition rules passes
    const valid = pwd.validatePolicy('cafe-com-leite-manha-tranquila');
    assert.equal(valid, 'cafe-com-leite-manha-tranquila');
  });

  it('hashes with argon2id, detects rehash on param change, and supports dummy verification', async () => {
    const pwd = new PasswordService();
    const fastParams = { memoryCost: 4096, timeCost: 1, parallelism: 1 };
    const strongerParams = { memoryCost: 8192, timeCost: 2, parallelism: 1 };

    const hash = await pwd.hash('minha-frase-secreta-unica-2026', fastParams);
    assert.ok(hash.startsWith('$argon2id$'));
    assert.equal(await pwd.verify(hash, 'minha-frase-secreta-unica-2026'), true);
    assert.equal(await pwd.verify(hash, 'outra-frase-errada-2026'), false);
    assert.equal(pwd.needsRehash(hash, fastParams), false);
    assert.equal(pwd.needsRehash(hash, strongerParams), true);

    await pwd.verifyDummy('qualquer-senha-invalida', fastParams);
  });

  it('generates and verifies HMAC CSRF tokens in constant time and validates Origin', () => {
    const csrf = new CsrfService();
    const secret = 'test-csrf-secret-at-least-32-characters-long';

    const tokenA = csrf.generateToken('session-a', secret);
    const tokenB = csrf.generateToken('session-b', secret);

    assert.notEqual(tokenA, tokenB);
    assert.equal(csrf.verifyToken('session-a', tokenA, secret), true);
    assert.equal(csrf.verifyToken('session-a', tokenB, secret), false);
    assert.equal(csrf.verifyToken('session-a', undefined, secret), false);
    assert.equal(csrf.verifyToken('session-a', 'tampered', secret), false);

    assert.equal(csrf.isOriginAllowed('http://localhost:5199', ['http://localhost:5199']), true);
    assert.equal(csrf.isOriginAllowed('https://evil.example', ['http://localhost:5199']), false);
    assert.equal(csrf.isOriginAllowed(undefined, ['http://localhost:5199']), false);
  });

  it('enforces progressive rate limiting without permanent lockout', async () => {
    const clock = new FakeClock(1_700_000_000_000);
    const limiter = new InMemoryRateLimiter(clock);
    const rule = {
      maxAttempts: 2,
      windowSeconds: 60,
      baseBlockSeconds: 10,
      maxBlockSeconds: 40,
    };

    assert.equal((await limiter.consume('ip:1.2.3.4', rule)).allowed, true);
    assert.equal((await limiter.consume('ip:1.2.3.4', rule)).allowed, true);

    const blocked1 = await limiter.consume('ip:1.2.3.4', rule);
    assert.equal(blocked1.allowed, false);
    assert.equal(blocked1.retryAfterSeconds, 10);

    await assert.rejects(
      () => enforceRateLimit(limiter, [{ key: 'ip:1.2.3.4', rule }]),
      (err: unknown) => {
        const e = err as { statusCode?: number; code?: string; headers?: Record<string, string> };
        return e.statusCode === 429 && e.code === 'RATE_LIMITED' && Number(e.headers?.['retry-after']) >= 1;
      },
    );

    // After backoff expires, progressive delay doubles on next violation rather than permanent lock
    clock.advanceMs(11_000);
    const blocked2 = await limiter.consume('ip:1.2.3.4', rule);
    assert.equal(blocked2.allowed, false);
    assert.equal(blocked2.retryAfterSeconds, 20);

    // After sliding window expires completely, user can try again
    clock.advanceMs(61_000);
    assert.equal((await limiter.consume('ip:1.2.3.4', rule)).allowed, true);
    assert.ok(RATE_LIMIT_RULES.LOGIN_ACCOUNT.maxAttempts > 0);
  });

  it('redacts passwords, tokens, cookies, authorization headers and hashes in Pino logs and objects', () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        lines.push(chunk.toString('utf8'));
        cb();
      },
    });

    const logger = createAppLogger({ LOG_LEVEL: 'info', NODE_ENV: 'test' }, 'test-svc', stream);
    logger.info(
      {
        password: 'SUPER-SECRET-PASSWORD-123',
        token: 'RAW-OPAQUE-TOKEN-XYZ',
        tokenHash: 'HASHED-TOKEN-ABC',
        req: {
          headers: {
            authorization: 'Bearer SECRET-BEARER',
            cookie: 'sid_customer=SECRET-COOKIE-VAL',
            'x-csrf-token': 'SECRET-CSRF-VAL',
          },
        },
        nested: {
          passwordHash: '$argon2id$v=19$secret',
          secret: 'MY-SECRET-KEY',
        },
      },
      'auth event',
    );

    const output = lines.join('\n');
    assert.ok(!output.includes('SUPER-SECRET-PASSWORD-123'));
    assert.ok(!output.includes('RAW-OPAQUE-TOKEN-XYZ'));
    assert.ok(!output.includes('HASHED-TOKEN-ABC'));
    assert.ok(!output.includes('SECRET-BEARER'));
    assert.ok(!output.includes('SECRET-COOKIE-VAL'));
    assert.ok(!output.includes('SECRET-CSRF-VAL'));
    assert.ok(!output.includes('$argon2id$v=19$secret'));
    assert.ok(!output.includes('MY-SECRET-KEY'));
    assert.ok(output.includes('[REDACTED]'));

    const redactedObj = redactSensitiveData({
      email: 'alice@example.com',
      passwordHash: 'argon2-hash',
      nested: { csrfToken: 'abc', safe: 42 },
    });
    assert.equal(redactedObj.email, 'alice@example.com');
    assert.equal(redactedObj.passwordHash, '[REDACTED]');
    assert.equal(redactedObj.nested.csrfToken, '[REDACTED]');
    assert.equal(redactedObj.nested.safe, 42);
  });

  it('uses __Host- cookie prefix when COOKIE_SECURE=true and fails production boot on weak config', () => {
    assert.equal(getSessionCookieName('customer', false), 'sid_customer');
    assert.equal(getSessionCookieName('staff', false), 'sid_staff');
    assert.equal(getSessionCookieName('customer', true), '__Host-sid_customer');
    assert.equal(getSessionCookieName('staff', true), '__Host-sid_staff');
    assert.equal(hashSessionToken('abc').length, 64);

    resetEnvCache();
    const baseProdEnv = loadEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      S3_ENDPOINT: 'http://localhost:8333',
      S3_PUBLIC_ENDPOINT: 'http://localhost:8333',
      S3_ACCESS_KEY_ID: 'k',
      S3_SECRET_ACCESS_KEY: 's',
      S3_PUBLIC_BUCKET: 'pub',
      S3_PRIVATE_BUCKET: 'priv',
      COOKIE_SECURE: 'false',
      COOKIE_SECRET: DEV_DEFAULT_COOKIE_SECRET,
      CSRF_SECRET: 'minieshop-dev-csrf-secret-change-me-32chars',
      EMAIL_TOKEN_SECRET: 'minieshop-dev-email-token-secret-change-me',
    });

    assert.throws(() => assertSecurityConfig(baseProdEnv), /COOKIE_SECURE must be true/);

    const strongProdEnv = loadEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      S3_ENDPOINT: 'http://localhost:8333',
      S3_PUBLIC_ENDPOINT: 'http://localhost:8333',
      S3_ACCESS_KEY_ID: 'k',
      S3_SECRET_ACCESS_KEY: 's',
      S3_PUBLIC_BUCKET: 'pub',
      S3_PRIVATE_BUCKET: 'priv',
      COOKIE_SECURE: 'true',
      COOKIE_SECRET: 'prod-cookie-secret-with-more-than-32-random-chars-1',
      CSRF_SECRET: 'prod-csrf-secret-with-more-than-32-random-chars-2',
      EMAIL_TOKEN_SECRET: 'prod-email-secret-with-more-than-32-random-chars-3',
    });
    assert.doesNotThrow(() => assertSecurityConfig(strongProdEnv));
  });
});
