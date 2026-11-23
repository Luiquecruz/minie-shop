import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { apiErrorResponseSchema } from '@minieshop/contracts';
import { assertChaosSafety, parseChaosDelayMs, registerChaosHook } from './chaos.middleware.js';

describe('T17 — Chaos Middleware (dev-only)', () => {
  it('refuses to boot when NODE_ENV=production and CHAOS_ENABLED=true', () => {
    assert.throws(
      () => assertChaosSafety({ NODE_ENV: 'production', CHAOS_ENABLED: true }),
      /CHAOS_ENABLED=true is forbidden when NODE_ENV=production/,
    );
  });

  it('does not register hook when NODE_ENV=production and CHAOS_ENABLED=false', async () => {
    const fastify = Fastify();
    const warnings: unknown[] = [];
    const registered = registerChaosHook(
      fastify,
      { NODE_ENV: 'production', CHAOS_ENABLED: false },
      { warn: (obj: unknown) => warnings.push(obj) },
    );

    assert.equal(registered, false);
    assert.equal(warnings.length, 0);

    fastify.get('/ping', async () => ({ ok: true }));
    await fastify.ready();

    const res = await fastify.inject({
      method: 'GET',
      url: '/ping',
      headers: {
        'x-chaos-fail': '1',
        'x-chaos-status': '500',
      },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true });
    await fastify.close();
  });

  it('clamps delay values and parses min-max ranges up to 10000ms', () => {
    assert.equal(parseChaosDelayMs('50'), 50);
    assert.equal(parseChaosDelayMs('99999'), 10000);
    assert.equal(parseChaosDelayMs('100-200', () => 0), 100);
    assert.equal(parseChaosDelayMs('100-200', () => 0.9999), 200);
    assert.equal(parseChaosDelayMs('300-100'), null);
    assert.equal(parseChaosDelayMs('invalid'), null);
  });

  it('injects delay, 503 CHAOS_FAILURE, and custom status while exempting /health and /ready', async () => {
    const fastify = Fastify({ genReqId: () => 'chaos-req-1' });
    const warnings: unknown[] = [];
    const registered = registerChaosHook(
      fastify,
      { NODE_ENV: 'development', CHAOS_ENABLED: true },
      { warn: (obj: unknown) => warnings.push(obj) },
    );

    assert.equal(registered, true);
    assert.equal(warnings.length, 1);

    fastify.get('/health', async () => ({ status: 'ok' }));
    fastify.get('/ready', async () => ({ status: 'ready' }));
    fastify.get('/catalog-sample', async () => ({ ok: true }));
    await fastify.ready();

    // /health and /ready must ignore chaos headers
    const healthRes = await fastify.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-chaos-fail': '1', 'x-chaos-status': '503' },
    });
    assert.equal(healthRes.statusCode, 200);

    const readyRes = await fastify.inject({
      method: 'GET',
      url: '/ready',
      headers: { 'x-chaos-fail': '1', 'x-chaos-status': '500' },
    });
    assert.equal(readyRes.statusCode, 200);

    // x-chaos-fail=1 -> 503 CHAOS_FAILURE
    const failRes = await fastify.inject({
      method: 'GET',
      url: '/catalog-sample',
      headers: { 'x-chaos-fail': '1' },
    });
    assert.equal(failRes.statusCode, 503);
    const failBody = apiErrorResponseSchema.parse(failRes.json());
    assert.equal(failBody.error.code, 'CHAOS_FAILURE');
    assert.equal(failBody.error.requestId, 'chaos-req-1');

    // x-chaos-status=429 -> 429 CHAOS_FAILURE
    const statusRes = await fastify.inject({
      method: 'GET',
      url: '/catalog-sample',
      headers: { 'x-chaos-status': '429' },
    });
    assert.equal(statusRes.statusCode, 429);
    const statusBody = apiErrorResponseSchema.parse(statusRes.json());
    assert.equal(statusBody.error.code, 'CHAOS_FAILURE');

    // x-chaos-delay=60 -> measurable latency
    const start = Date.now();
    const delayRes = await fastify.inject({
      method: 'GET',
      url: '/catalog-sample',
      headers: { 'x-chaos-delay': '60' },
    });
    const elapsed = Date.now() - start;
    assert.equal(delayRes.statusCode, 200);
    assert.ok(elapsed >= 50, `Expected delay >= 50ms, got ${elapsed}ms`);

    await fastify.close();
  });
});
