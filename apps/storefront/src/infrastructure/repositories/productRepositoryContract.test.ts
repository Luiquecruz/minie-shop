import { describe, expect, it } from 'vitest';
import type { SupportedCurrency } from '@minieshop/contracts';
import type { ProductRepository } from '../../domain/repositories/ProductRepository';
import { FIXTURE_PRODUCTS_DETAIL } from '../../test/fixtures/catalogFixture';
import { ApiError } from '../http/errors';
import { HttpClient } from '../http/httpClient';
import { HttpProductRepository } from './HttpProductRepository';
import { MockProductRepository } from './MockProductRepository';

/**
 * Creates an in-process fetch adapter backed by MockProductRepository so the
 * exact same contract test suite runs against BOTH MockProductRepository and
 * HttpProductRepository (proving identical interface & serialization behavior).
 */
function createHttpBackedByMock(): HttpProductRepository {
  const backend = new MockProductRepository();

  const fetchAdapter: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const method = (init?.method ?? 'GET').toUpperCase();
    const signal = init?.signal ?? undefined;

    try {
      if (method === 'GET' && url.pathname === '/categories') {
        const data = await backend.getCategories(signal);
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'GET' && url.pathname === '/products/facets') {
        const params = parseQueryParams(url.searchParams);
        const data = await backend.getFacets(params, signal);
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'GET' && url.pathname === '/products') {
        const params = parseQueryParams(url.searchParams);
        const data = await backend.listProducts(
          {
            ...params,
            sort: (url.searchParams.get('sort') as
              | 'newest'
              | 'price_asc'
              | 'price_desc'
              | 'name_asc'
              | 'relevance'
              | null) ?? undefined,
            limit: url.searchParams.has('limit')
              ? Number(url.searchParams.get('limit'))
              : undefined,
            cursor: url.searchParams.get('cursor') ?? undefined,
          },
          signal,
        );
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'GET' && url.pathname.startsWith('/products/')) {
        const slug = decodeURIComponent(url.pathname.slice('/products/'.length));
        const currency =
          (url.searchParams.get('currency') as 'BRL' | 'USD' | 'EUR' | null) ??
          'BRL';
        const data = await backend.getProductBySlug(slug, signal, currency);
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'POST' && url.pathname === '/pricing/quote') {
        const rawBody = typeof init?.body === 'string' ? init.body : '{}';
        const parsedBody = JSON.parse(rawBody) as {
          currency?: 'BRL' | 'USD' | 'EUR';
          productIds?: string[];
        };
        const data = await backend.quotePricing(
          {
            currency: parsedBody.currency ?? 'BRL',
            productIds: parsedBody.productIds ?? [],
          },
          signal,
        );
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'GET' && url.pathname === '/favorites') {
        const data = await backend.getFavorites(signal);
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'POST' && url.pathname.startsWith('/favorites/')) {
        const productId = decodeURIComponent(
          url.pathname.slice('/favorites/'.length),
        );
        const data = await backend.addFavorite(productId, signal);
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'DELETE' && url.pathname.startsWith('/favorites/')) {
        const productId = decodeURIComponent(
          url.pathname.slice('/favorites/'.length),
        );
        await backend.removeFavorite(productId, signal);
        return new Response(null, { status: 204 });
      }

      return new Response(
        JSON.stringify({
          error: {
            code: 'NOT_FOUND',
            message: 'Route not found',
            requestId: 'adapter-req',
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        return new Response(
          JSON.stringify({
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
              requestId: error.requestId,
            },
          }),
          {
            status: error.status,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      throw error;
    }
  };

  return new HttpProductRepository(
    new HttpClient({
      baseUrl: 'http://localhost:3001',
      fetchFn: fetchAdapter,
    }),
  );
}

function parseQueryParams(searchParams: URLSearchParams) {
  const attributes: Record<string, string[]> = {};
  const numericAttributes: Record<string, { min?: number; max?: number }> = {};

  for (const [key, value] of searchParams.entries()) {
    if (!key.startsWith('attr.')) continue;
    const rest = key.slice('attr.'.length);
    const rangeMatch = /^([a-z0-9_]+)\.(min|max)$/.exec(rest);
    if (rangeMatch) {
      const code = rangeMatch[1];
      const bound = rangeMatch[2] as 'min' | 'max';
      numericAttributes[code] = {
        ...numericAttributes[code],
        [bound]: Number(value),
      };
    } else {
      attributes[rest] = value.split(',').filter(Boolean);
    }
  }

  const rawCurrency = searchParams.get('currency');
  const currency: SupportedCurrency | undefined =
    rawCurrency === 'BRL' || rawCurrency === 'USD' || rawCurrency === 'EUR'
      ? rawCurrency
      : undefined;

  return {
    currency,
    category: searchParams.get('category') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    minPrice: searchParams.has('minPrice')
      ? Number(searchParams.get('minPrice'))
      : undefined,
    maxPrice: searchParams.has('maxPrice')
      ? Number(searchParams.get('maxPrice'))
      : undefined,
    inStock: searchParams.has('inStock')
      ? searchParams.get('inStock') === 'true'
      : undefined,
    attributes,
    numericAttributes,
  };
}

function runProductRepositoryContractSuite(
  name: string,
  factory: () => ProductRepository,
): void {
  describe(`ProductRepository contract — ${name}`, () => {
    it('lists products with cursor pagination, filters, and sorting', async () => {
      const repo = factory();

      const page1 = await repo.listProducts({ sort: 'price_asc', limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).not.toBeNull();
      expect(page1.items[0].price.amount).toBeLessThanOrEqual(
        page1.items[1].price.amount,
      );

      const page2 = await repo.listProducts({
        sort: 'price_asc',
        limit: 2,
        cursor: page1.nextCursor ?? undefined,
      });
      expect(page2.items.length).toBeGreaterThan(0);
      expect(page2.items[0].id).not.toBe(page1.items[0].id);

      const filtered = await repo.listProducts({
        category: 'eletronicos',
        inStock: true,
        attributes: { connectivity: ['Bluetooth'] },
      });
      expect(filtered.items.length).toBeGreaterThan(0);
      expect(filtered.items.every((item) => item.inStock)).toBe(true);
    });

    it('returns product detail by slug and throws ApiError 404 for unknown slug', async () => {
      const repo = factory();
      const target = FIXTURE_PRODUCTS_DETAIL[0];

      const detail = await repo.getProductBySlug(target.slug);
      expect(detail.id).toBe(target.id);
      expect(detail.breadcrumbs.length).toBeGreaterThan(0);

      await expect(repo.getProductBySlug('slug-inexistente')).rejects.toSatisfy(
        (err: unknown) => err instanceof ApiError && err.isNotFound,
      );
    });

    it('returns category tree and disjunctive facets', async () => {
      const repo = factory();
      const categories = await repo.getCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0].children.length).toBeGreaterThan(0);

      const facets = await repo.getFacets({ category: 'audio' });
      expect(facets.price.min).not.toBeNull();
      expect(facets.categories.length).toBeGreaterThan(1);
      expect(facets.attributes.length).toBeGreaterThan(0);

      const usdFacets = await repo.getFacets({
        currency: 'USD',
        maxPrice: 4_000,
      });
      const usdList = await repo.listProducts({
        currency: 'USD',
        maxPrice: 4_000,
      });
      expect(usdList.items.every((item) => item.price.currency === 'USD')).toBe(
        true,
      );
      expect(usdList.items.every((item) => item.price.amount <= 4_000)).toBe(
        true,
      );
      expect(usdFacets.price.max ?? 0).toBeLessThan(10_000);
      expect(usdFacets.attributes.length).toBeGreaterThan(0);
    });

    it('batches quotePricing requests exceeding 100 unique productIds cleanly', async () => {
      const repo = factory();
      const ids = Array.from({ length: 105 }, (_, idx) =>
        `99999999-0000-4000-8000-${String(idx).padStart(12, '0')}`,
      );
      ids[0] = FIXTURE_PRODUCTS_DETAIL[0].id.toUpperCase();
      ids[102] = FIXTURE_PRODUCTS_DETAIL[1].id.toUpperCase();

      const quoted = await repo.quotePricing({
        currency: 'USD',
        productIds: ids,
      });
      expect(quoted.currency).toBe('USD');
      expect(quoted.items.map((item) => item.productId)).toEqual([
        FIXTURE_PRODUCTS_DETAIL[0].id,
        FIXTURE_PRODUCTS_DETAIL[1].id,
      ]);
    });

    it('lists, adds, and removes favorites idempotently', async () => {
      const repo = factory();
      const productId = FIXTURE_PRODUCTS_DETAIL[0].id;

      expect((await repo.getFavorites()).productIds).toEqual([]);

      const added = await repo.addFavorite(productId);
      expect(added).toEqual({ favorited: true });
      expect((await repo.getFavorites()).productIds).toEqual([productId]);

      await repo.removeFavorite(productId);
      expect((await repo.getFavorites()).productIds).toEqual([]);
    });
  });
}

runProductRepositoryContractSuite(
  'MockProductRepository',
  () => new MockProductRepository(),
);
runProductRepositoryContractSuite(
  'HttpProductRepository',
  () => createHttpBackedByMock(),
);
