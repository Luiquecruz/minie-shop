import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientProductListResponseSchema } from '@minieshop/contracts/catalog/client';
import { productListResponseSchema } from '@minieshop/contracts';
import { FIXTURE_PRODUCT_CARDS } from '../../test/fixtures/catalogFixture';
import { resetDevChaosConfig, writeDevChaosKey } from './chaos';
import {
  ApiError,
  ContractViolationError,
  NetworkError,
  isAbortError,
} from './errors';
import { HttpClient } from './httpClient';

function jsonResponse(
  body: unknown,
  init: { status?: number; statusText?: string; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

describe('HttpClient', () => {
  afterEach(() => {
    resetDevChaosConfig();
  });

  it('parses valid response with credentials: include and tolerates additive unknown fields (.strip)', async () => {
    const payloadWithExtraFields = {
      items: [
        {
          ...FIXTURE_PRODUCT_CARDS[0],
          futureFlag: true,
          price: {
            ...FIXTURE_PRODUCT_CARDS[0].price,
            displayHint: 'promo',
          },
        },
      ],
      nextCursor: null,
      apiVersion: '2026-12',
    };

    // Confirm server schema remains strictly rejecting extra fields
    expect(productListResponseSchema.safeParse(payloadWithExtraFields).success).toBe(
      false,
    );

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(payloadWithExtraFields),
    );
    const client = new HttpClient({
      baseUrl: 'http://localhost:3001',
      fetchFn: fetchMock,
    });

    const data = await client.get('/products', clientProductListResponseSchema);

    expect(data.items).toHaveLength(1);
    expect(data.items[0].slug).toBe(FIXTURE_PRODUCT_CARDS[0].slug);
    expect('futureFlag' in data.items[0]).toBe(false);
    expect('apiVersion' in data).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/products',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    );
  });

  it('converts standardized API error envelope into typed ApiError', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Product not found',
            requestId: 'req-123',
            details: [{ path: 'slug', message: 'Not found' }],
            extraDebugField: 'ignored-by-tolerant-parser',
          },
        },
        { status: 404, statusText: 'Not Found' },
      ),
    );

    const client = new HttpClient({
      baseUrl: 'http://localhost:3001',
      fetchFn: fetchMock,
    });

    await expect(
      client.get('/products/missing', clientProductListResponseSchema),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'NOT_FOUND',
      message: 'Product not found',
      requestId: 'req-123',
      isNotFound: true,
      isClientError: true,
    });
  });

  it('converts network failure into distinct NetworkError', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('Failed to fetch'));

    const client = new HttpClient({
      baseUrl: 'http://localhost:3001',
      fetchFn: fetchMock,
    });

    await expect(
      client.get('/products', clientProductListResponseSchema),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof NetworkError && err.isTimeout === false,
    );
  });

  it('converts request timeout into NetworkError with isTimeout=true', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Timed out', 'AbortError'));
          });
        }),
    );

    const client = new HttpClient({
      baseUrl: 'http://localhost:3001',
      timeoutMs: 25,
      fetchFn: fetchMock,
    });

    await expect(
      client.get('/products', clientProductListResponseSchema),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof NetworkError && err.isTimeout === true,
    );
  });

  it('propagates external AbortSignal cancellation as AbortError', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The request was aborted.', 'AbortError'));
          });
        }),
    );

    const client = new HttpClient({
      baseUrl: 'http://localhost:3001',
      fetchFn: fetchMock,
    });

    const promise = client.get('/products', clientProductListResponseSchema, {
      signal: controller.signal,
    });
    controller.abort();

    await expect(promise).rejects.toSatisfy((err: unknown) => isAbortError(err));
  });

  it('throws ContractViolationError and logs details on invalid response payload', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        items: [{ id: 'not-a-uuid', name: 123 }],
        nextCursor: null,
      }),
    );

    const client = new HttpClient({
      baseUrl: 'http://localhost:3001',
      fetchFn: fetchMock,
    });

    await expect(
      client.get('/products', clientProductListResponseSchema),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ContractViolationError &&
        err.endpoint === '/products' &&
        err.issues.length > 0,
    );

    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it('injects x-chaos-* headers from localStorage in DEV mode', async () => {
    writeDevChaosKey('delay', '400');
    writeDevChaosKey('fail', '0.5');
    writeDevChaosKey('status', '503');

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ items: [], nextCursor: null }),
    );
    const client = new HttpClient({
      baseUrl: 'http://localhost:3001',
      fetchFn: fetchMock,
    });

    await client.get('/products', clientProductListResponseSchema);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/products',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-chaos-delay': '400',
          'x-chaos-fail': '0.5',
          'x-chaos-status': '503',
        }),
      }),
    );
  });

  it('handles 204 No Content on DELETE without attempting JSON parse', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const client = new HttpClient({
      baseUrl: 'http://localhost:3001',
      fetchFn: fetchMock,
    });

    await expect(
      client.delete('/favorites/20000000-0000-4000-8000-000000000001'),
    ).resolves.toBeUndefined();
    expect(ApiError).toBeDefined();
  });

  it('converts response-body transport failures into NetworkError', async () => {
    const brokenResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: () => Promise.reject(new TypeError('stream reset')),
    } as unknown as Response;

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(brokenResponse);
    const client = new HttpClient({
      baseUrl: 'http://localhost:3001',
      fetchFn: fetchMock,
    });

    await expect(
      client.get('/products', clientProductListResponseSchema),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof NetworkError && err.isTimeout === false,
    );
  });

  it('keeps timeout active while consuming a stalled response body', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      const stalledResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () =>
          new Promise<string>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Body read aborted', 'AbortError'));
            });
          }),
      } as unknown as Response;
      return Promise.resolve(stalledResponse);
    });

    const client = new HttpClient({
      baseUrl: 'http://localhost:3001',
      timeoutMs: 25,
      fetchFn: fetchMock,
    });

    await expect(
      client.get('/products', clientProductListResponseSchema),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof NetworkError && err.isTimeout === true,
    );
  });

  it('attaches cached x-csrf-token on state-changing requests and retries once after 403 CSRF_INVALID', async () => {
    let postAttempt = 0;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/csrf')) {
        return jsonResponse({ csrfToken: 'fresh-csrf-token-123' });
      }
      postAttempt += 1;
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (postAttempt === 1) {
        expect(headers['x-csrf-token']).toBe('stale-token');
        return jsonResponse(
          {
            error: {
              code: 'CSRF_INVALID',
              message: 'Invalid CSRF token',
              requestId: 'req-csrf-1',
            },
          },
          { status: 403, statusText: 'Forbidden' },
        );
      }
      expect(headers['x-csrf-token']).toBe('fresh-csrf-token-123');
      return jsonResponse({ items: [], nextCursor: null });
    });

    const client = new HttpClient({
      baseUrl: 'http://localhost:3001',
      fetchFn: fetchMock,
      initialCsrfToken: 'stale-token',
    });

    const data = await client.post(
      '/pricing/quote',
      clientProductListResponseSchema,
      { body: { currency: 'USD', productIds: [] } },
    );

    expect(data.items).toEqual([]);
    expect(postAttempt).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Subsequent DELETE reuses the newly cached CSRF token without refetching /auth/csrf
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.delete('/favorites/20000000-0000-4000-8000-000000000001');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:3001/favorites/20000000-0000-4000-8000-000000000001',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          'x-csrf-token': 'fresh-csrf-token-123',
        }),
      }),
    );
  });

  it('deduplicates concurrent GET /auth/csrf refreshes and returns null cleanly on 401', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({ csrfToken: 'shared-csrf-token' }),
    );

    const client = new HttpClient({
      baseUrl: 'http://localhost:3001',
      fetchFn: fetchMock,
    });

    const [t1, t2] = await Promise.all([
      client.fetchCsrfToken(),
      client.fetchCsrfToken(),
    ]);

    expect(t1).toBe('shared-csrf-token');
    expect(t2).toBe('shared-csrf-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Unauthenticated /auth/csrf returns null cleanly
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Sign in required',
            requestId: 'req-401',
          },
        },
        { status: 401, statusText: 'Unauthorized' },
      ),
    );
    await expect(client.fetchCsrfToken()).resolves.toBeNull();
  });

  it('aborts waiting caller immediately during CSRF refresh without cancelling the shared refresh', async () => {
    let resolveCsrf!: (response: Response) => void;
    const csrfPromise = new Promise<Response>((resolve) => {
      resolveCsrf = resolve;
    });

    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/csrf')) {
        return csrfPromise;
      }
      return jsonResponse(
        {
          error: {
            code: 'CSRF_INVALID',
            message: 'Expired CSRF token',
            requestId: 'req-csrf-abort',
          },
        },
        { status: 403, statusText: 'Forbidden' },
      );
    });

    const client = new HttpClient({
      baseUrl: 'http://localhost:3001',
      fetchFn: fetchMock,
    });

    const controller = new AbortController();
    const requestPromise = client.post(
      '/pricing/quote',
      clientProductListResponseSchema,
      { body: { currency: 'BRL', productIds: [] }, signal: controller.signal },
    );

    // Wait a tick for POST 403 -> GET /auth/csrf to be in flight
    await Promise.resolve();
    await Promise.resolve();

    controller.abort();
    await expect(requestPromise).rejects.toSatisfy((err: unknown) =>
      isAbortError(err),
    );

    // Shared refresh still settles cleanly for other callers
    resolveCsrf(jsonResponse({ csrfToken: 'recovered-token' }));
    await expect(csrfPromise).resolves.toBeInstanceOf(Response);
  });
});
