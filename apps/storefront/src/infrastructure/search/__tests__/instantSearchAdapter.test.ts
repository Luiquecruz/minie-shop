import { describe, expect, it, vi } from 'vitest';
import { MockProductRepository } from '../../repositories/MockProductRepository';
import { ApiError } from '../../http/errors';
import { FIXTURE_PRODUCT_CARDS } from '../../../test/fixtures/catalogFixture';
import {
  createStorefrontSearchClient,
  SEARCH_HITS_PER_PAGE,
} from '../instantSearchAdapter';

interface AdapterResponseShape {
  results: Array<{
    hits: Array<{ objectID: string; id: string }>;
    nbHits: number;
    page: number;
    nbPages: number;
    hitsPerPage: number;
    query: string;
    userData?: Array<{ mode: string; durationMs: number; query: string }>;
  }>;
}

describe('createStorefrontSearchClient — InstantSearch adapter (S08.3)', () => {
  it('short-circuits empty queries without calling repository.searchProducts', async () => {
    const repository = new MockProductRepository();
    const searchSpy = vi.spyOn(repository, 'searchProducts');
    const client = createStorefrontSearchClient(repository);

    const response = (await client.search([
      { indexName: 'products', params: { query: '   ', page: 0, hitsPerPage: 24 } },
    ])) as unknown as AdapterResponseShape;

    expect(searchSpy).not.toHaveBeenCalled();
    expect(response.results[0]).toMatchObject({
      hits: [],
      nbHits: 0,
      page: 0,
      nbPages: 0,
      query: '',
    });
  });

  it('maps page and hitsPerPage to offset and limit=24, adds objectID, and sets nbHits/nbPages', async () => {
    const repository = new MockProductRepository();
    const searchSpy = vi
      .spyOn(repository, 'searchProducts')
      .mockResolvedValue({
        items: [FIXTURE_PRODUCT_CARDS[0], FIXTURE_PRODUCT_CARDS[1]],
        estimatedTotal: 50,
        mode: 'hybrid',
      });

    const telemetryEvents: Array<{ mode: string; durationMs: number; query: string }> = [];
    const client = createStorefrontSearchClient(repository, {
      onTelemetry: (meta) => telemetryEvents.push(meta),
    });

    const response = (await client.search([
      {
        indexName: 'products',
        params: { query: '  fone  ', page: 2, hitsPerPage: SEARCH_HITS_PER_PAGE },
      },
    ])) as unknown as AdapterResponseShape;

    expect(searchSpy).toHaveBeenCalledWith(
      {
        q: 'fone',
        limit: 24,
        offset: 48,
      },
      expect.any(AbortSignal),
    );

    const first = response.results[0];
    expect(first.hits).toHaveLength(2);
    expect(first.hits[0].objectID).toBe(FIXTURE_PRODUCT_CARDS[0].id);
    expect(first.nbHits).toBe(50);
    expect(first.page).toBe(2);
    expect(first.nbPages).toBe(3);
    expect(first.hitsPerPage).toBe(24);
    expect(first.query).toBe('fone');
    expect(first.userData?.[0].mode).toBe('hybrid');
    expect(telemetryEvents[0].mode).toBe('hybrid');
  });

  it('prevents API calls when offset exceeds API limit of 200', async () => {
    const repository = new MockProductRepository();
    const searchSpy = vi.spyOn(repository, 'searchProducts');
    const client = createStorefrontSearchClient(repository);

    const response = (await client.search([
      { indexName: 'products', params: { query: 'fone', page: 9, hitsPerPage: 24 } },
    ])) as unknown as AdapterResponseShape;

    expect(searchSpy).not.toHaveBeenCalled();
    expect(response.results[0].hits).toEqual([]);
  });

  it('propagates repository errors so InstantSearch error handling can catch them', async () => {
    const repository = new MockProductRepository({
      errorOn: {
        search: new ApiError({
          status: 503,
          code: 'CHAOS_FAILURE',
          message: 'Search error',
          requestId: 'req-search-err',
        }),
      },
    });
    const client = createStorefrontSearchClient(repository);

    await expect(
      client.search([
        { indexName: 'products', params: { query: 'fone', page: 0, hitsPerPage: 24 } },
      ]),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('aborts an in-flight search when a newer query arrives and defers superseded settlement', async () => {
    const repository = new MockProductRepository();
    const signals: AbortSignal[] = [];
    const settlementOrder: string[] = [];

    vi.spyOn(repository, 'searchProducts').mockImplementation((params, signal) => {
      if (signal) {
        signals.push(signal);
      }
      if (params.q === 'relogi') {
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('The request was aborted.', 'AbortError'));
          });
        });
      }
      return Promise.resolve({
        items: [FIXTURE_PRODUCT_CARDS[0]],
        estimatedTotal: 1,
        mode: 'hybrid',
      });
    });

    const client = createStorefrontSearchClient(repository);

    const firstPromise = client
      .search([
        { indexName: 'products', params: { query: 'relogi', page: 0, hitsPerPage: 24 } },
      ])
      .then((res) => {
        settlementOrder.push('first');
        return res;
      });

    const secondPromise = client
      .search([
        { indexName: 'products', params: { query: 'relogio branco', page: 0, hitsPerPage: 24 } },
      ])
      .then((res) => {
        settlementOrder.push('second');
        return res;
      });

    const [firstResult, secondResult] = (await Promise.all([
      firstPromise,
      secondPromise,
    ])) as unknown as [AdapterResponseShape, AdapterResponseShape];

    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    expect(settlementOrder).toEqual(['second', 'first']);
    expect(secondResult.results[0].hits).toHaveLength(1);
    expect(firstResult.results[0].hits).toEqual([]);
  });
});
