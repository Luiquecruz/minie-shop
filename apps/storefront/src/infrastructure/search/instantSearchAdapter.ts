import type { ProductCardDTO, SearchMode } from '@minieshop/contracts';
import {
  MAX_SEARCH_LIMIT,
  MAX_SEARCH_OFFSET,
  SEARCH_PAGE_SIZE,
  type ProductRepository,
} from '../../domain/repositories/ProductRepository';
import { MAX_SEARCH_QUERY_LENGTH } from '../../utils/searchUrlParams';
import { isAbortError } from '../http/errors';

export const SEARCH_INDEX_NAME = 'products';
export const SEARCH_HITS_PER_PAGE = SEARCH_PAGE_SIZE;

export type StorefrontSearchHit = ProductCardDTO & {
  objectID: string;
};

export interface SearchTelemetry {
  mode: SearchMode;
  durationMs: number;
  query: string;
}

export interface StorefrontSearchRequest {
  indexName?: string;
  params?: {
    query?: unknown;
    page?: unknown;
    hitsPerPage?: unknown;
  };
}

export interface StorefrontSearchResultItem {
  hits: StorefrontSearchHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  query: string;
  processingTimeMS: number;
  exhaustiveNbHits: boolean;
  params: string;
  userData?: SearchTelemetry[];
}

export interface StorefrontSearchClient {
  search: (
    requests: ReadonlyArray<StorefrontSearchRequest>,
  ) => Promise<{ results: StorefrontSearchResultItem[] }>;
  searchForFacetValues: () => Promise<{
    facetHits: never[];
    exhaustiveFacetsCount: boolean;
  }>;
}

function buildEmptyResponse(
  query: string,
  page: number,
  hitsPerPage: number,
  nbPages: number = 0,
): StorefrontSearchResultItem {
  return {
    hits: [],
    nbHits: 0,
    page,
    nbPages,
    hitsPerPage,
    query,
    processingTimeMS: 0,
    exhaustiveNbHits: true,
    params: '',
  };
}

export interface CreateSearchClientOptions {
  onTelemetry?: (telemetry: SearchTelemetry) => void;
}

/**
 * Adapts `ProductRepository.searchProducts` (`GET /search`) to the custom
 * `SearchClient` contract expected by `react-instantsearch@7.55.1` / `instantsearch.js@4.123.1`.
 */
export function createStorefrontSearchClient(
  repository: ProductRepository,
  options?: CreateSearchClientOptions,
): StorefrontSearchClient {
  let activeRequest: {
    controller: AbortController;
    settledBySuperseding: Promise<void>;
    resolveSuperseded: () => void;
  } | null = null;

  return {
    search(requests: ReadonlyArray<StorefrontSearchRequest>) {
      const previousRequest = activeRequest;
      if (previousRequest) {
        previousRequest.controller.abort();
      }

      const controller = new AbortController();
      let resolveSuperseded!: () => void;
      const settledBySuperseding = new Promise<void>((resolve) => {
        resolveSuperseded = resolve;
      });
      const currentRequest = {
        controller,
        settledBySuperseding,
        resolveSuperseded,
      };
      activeRequest = currentRequest;

      const buildSupersededFallback = (): { results: StorefrontSearchResultItem[] } => ({
        results: requests.map((request) => {
          const rawQuery =
            typeof request.params?.query === 'string'
              ? request.params.query
              : '';
          const trimmedQuery = rawQuery
            .trim()
            .slice(0, MAX_SEARCH_QUERY_LENGTH);
          const rawHitsPerPage =
            typeof request.params?.hitsPerPage === 'number' &&
            Number.isFinite(request.params.hitsPerPage) &&
            request.params.hitsPerPage > 0
              ? Math.trunc(request.params.hitsPerPage)
              : SEARCH_HITS_PER_PAGE;
          const hitsPerPage = Math.min(MAX_SEARCH_LIMIT, rawHitsPerPage);
          const page =
            typeof request.params?.page === 'number' &&
            Number.isFinite(request.params.page) &&
            request.params.page >= 0
              ? Math.trunc(request.params.page)
              : 0;
          return buildEmptyResponse(trimmedQuery, page, hitsPerPage, 0);
        }),
      });

      const executionPromise = (async (): Promise<{ results: StorefrontSearchResultItem[] }> => {
        try {
          const results = await Promise.all(
            requests.map(async (request) => {
              const rawQuery =
                typeof request.params?.query === 'string'
                  ? request.params.query
                  : '';
              const trimmedQuery = rawQuery
                .trim()
                .slice(0, MAX_SEARCH_QUERY_LENGTH);

              const rawHitsPerPage =
                typeof request.params?.hitsPerPage === 'number' &&
                Number.isFinite(request.params.hitsPerPage) &&
                request.params.hitsPerPage > 0
                  ? Math.trunc(request.params.hitsPerPage)
                  : SEARCH_HITS_PER_PAGE;
              const hitsPerPage = Math.min(MAX_SEARCH_LIMIT, rawHitsPerPage);

              const page =
                typeof request.params?.page === 'number' &&
                Number.isFinite(request.params.page) &&
                request.params.page >= 0
                  ? Math.trunc(request.params.page)
                  : 0;

              if (trimmedQuery.length === 0) {
                return buildEmptyResponse('', 0, hitsPerPage, 0);
              }

              const offset = page * hitsPerPage;
              if (offset > MAX_SEARCH_OFFSET) {
                return buildEmptyResponse(trimmedQuery, page, hitsPerPage, page);
              }

              const startedAt =
                typeof performance !== 'undefined' ? performance.now() : Date.now();
              const response = await repository.searchProducts(
                {
                  q: trimmedQuery,
                  limit: hitsPerPage,
                  offset,
                },
                controller.signal,
              );
              const endedAt =
                typeof performance !== 'undefined' ? performance.now() : Date.now();
              const durationMs = Math.max(0, Math.round(endedAt - startedAt));

              const hits: StorefrontSearchHit[] = response.items.map((item) => ({
                ...item,
                objectID: item.id,
              }));

              const nbHits = response.estimatedTotal;
              const nbPages = nbHits > 0 ? Math.ceil(nbHits / hitsPerPage) : 0;

              if (!controller.signal.aborted) {
                options?.onTelemetry?.({
                  mode: response.mode,
                  durationMs,
                  query: trimmedQuery,
                });
              }

              return {
                hits,
                nbHits,
                page,
                nbPages,
                hitsPerPage,
                query: trimmedQuery,
                processingTimeMS: durationMs,
                exhaustiveNbHits: false,
                params: '',
                userData: [
                  {
                    mode: response.mode,
                    durationMs,
                    query: trimmedQuery,
                  },
                ],
              };
            }),
          );

          if (controller.signal.aborted) {
            await settledBySuperseding;
            return buildSupersededFallback();
          }

          return { results };
        } catch (error) {
          if (controller.signal.aborted && isAbortError(error)) {
            // Defer settlement until the newer request updates InstantSearch's lastQueryIdReceived
            // so algoliasearch-helper discards this superseded call without flashing an error state.
            await settledBySuperseding;
            return buildSupersededFallback();
          }
          throw error;
        } finally {
          if (activeRequest === currentRequest) {
            activeRequest = null;
          }
        }
      })();

      if (previousRequest) {
        void executionPromise.then(
          () => previousRequest.resolveSuperseded(),
          () => previousRequest.resolveSuperseded(),
        );
      }

      return executionPromise;
    },

    async searchForFacetValues() {
      return { facetHits: [], exhaustiveFacetsCount: true };
    },
  };
}
