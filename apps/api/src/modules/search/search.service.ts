import { Inject, Injectable } from '@nestjs/common';
import type {
  SearchRequestedMode,
  SearchResponseDTO,
  SearchSuggestResponseDTO,
} from '@minieshop/contracts';
import { loadEnv } from '../../config/env.js';
import { CatalogService } from '../catalog/index.js';
import { SimpleCircuitBreaker } from './circuit-breaker.js';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from './embedding.port.js';
import { LruCache } from './lru-cache.js';
import { SEARCH_PORT, type SearchPort } from './search.port.js';

export interface SearchRequestParams {
  q: string;
  limit: number;
  offset: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  mode: SearchRequestedMode;
}

export interface SearchLogger {
  warn(obj: Record<string, unknown>, msg: string): void;
}

@Injectable()
export class SearchService {
  private readonly circuitBreaker = new SimpleCircuitBreaker(3, 15_000);
  private readonly queryVectorCache = new LruCache<string, number[]>(256, 5 * 60 * 1_000);

  constructor(
    @Inject(CatalogService)
    private readonly catalogService: CatalogService,
    @Inject(SEARCH_PORT)
    private readonly searchPort: SearchPort,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  resetRuntimeState(): void {
    this.circuitBreaker.reset();
    this.queryVectorCache.clear();
  }

  private async getQueryVector(
    q: string,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<number[]> {
    const cacheKey = `${this.embeddingProvider.modelName}:${q.trim().toLowerCase()}`;
    const cached = this.queryVectorCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const vector = await this.embeddingProvider.embedQuery(q, { timeoutMs, signal });
    this.queryVectorCache.set(cacheKey, vector);
    return vector;
  }

  async search(
    params: SearchRequestParams,
    context: { requestId: string; logger?: SearchLogger; signal?: AbortSignal },
  ): Promise<SearchResponseDTO> {
    const env = loadEnv();

    if (context.signal?.aborted) {
      return {
        items: [],
        estimatedTotal: 0,
        mode: 'keyword',
      };
    }

    if (this.circuitBreaker.canExecute()) {
      let queryVector: number[] | undefined;

      if (params.mode === 'hybrid') {
        try {
          queryVector = await this.getQueryVector(
            params.q,
            env.EMBEDDINGS_QUERY_TIMEOUT_MS,
            context.signal,
          );
        } catch (error) {
          if (context.signal?.aborted) {
            return {
              items: [],
              estimatedTotal: 0,
              mode: 'keyword',
            };
          }
          context.logger?.warn(
            {
              requestId: context.requestId,
              err: error instanceof Error ? error.message : String(error),
              fallbackMode: 'keyword',
            },
            'Query embedding failed or timed out; degrading search to keyword mode',
          );
        }
      }

      if (context.signal?.aborted) {
        return {
          items: [],
          estimatedTotal: 0,
          mode: 'keyword',
        };
      }

      try {
        const useHybrid = params.mode === 'hybrid' && queryVector !== undefined;
        const hits = await this.searchPort.search({
          q: params.q,
          limit: params.limit,
          offset: params.offset,
          category: params.category,
          minPrice: params.minPrice,
          maxPrice: params.maxPrice,
          inStock: params.inStock,
          ...(useHybrid
            ? {
                vector: queryVector,
                hybrid: {
                  embedder: env.MEILI_EMBEDDER_NAME,
                  semanticRatio: env.SEARCH_SEMANTIC_RATIO,
                },
              }
            : {}),
        });

        this.circuitBreaker.recordSuccess();
        const items = await this.catalogService.getProductCardsByIdsOrdered(hits.ids);

        return {
          items,
          estimatedTotal: Math.max(items.length, hits.estimatedTotal),
          mode: useHybrid ? 'hybrid' : 'keyword',
        };
      } catch (error) {
        this.circuitBreaker.recordFailure();
        context.logger?.warn(
          {
            requestId: context.requestId,
            err: error instanceof Error ? error.message : String(error),
            circuitState: this.circuitBreaker.getState(),
            fallbackMode: 'postgres',
          },
          'Search engine unavailable; degrading search to postgres fallback',
        );
      }
    } else {
      context.logger?.warn(
        {
          requestId: context.requestId,
          circuitState: this.circuitBreaker.getState(),
          fallbackMode: 'postgres',
        },
        'Search engine circuit breaker is open; serving from postgres fallback',
      );
    }

    const pgResult = await this.catalogService.searchProductsPostgresFallback({
      q: params.q,
      limit: params.limit,
      offset: params.offset,
      category: params.category,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      inStock: params.inStock,
    });

    return {
      items: pgResult.items,
      estimatedTotal: pgResult.estimatedTotal,
      mode: 'postgres',
    };
  }

  async suggest(
    q: string,
    limit: number,
    context: { requestId: string; logger?: SearchLogger },
  ): Promise<SearchSuggestResponseDTO> {
    if (this.circuitBreaker.canExecute()) {
      try {
        const suggestions = await this.searchPort.suggest(q, limit);
        this.circuitBreaker.recordSuccess();
        return {
          suggestions,
          mode: 'keyword',
        };
      } catch (error) {
        this.circuitBreaker.recordFailure();
        context.logger?.warn(
          {
            requestId: context.requestId,
            err: error instanceof Error ? error.message : String(error),
            circuitState: this.circuitBreaker.getState(),
            fallbackMode: 'postgres',
          },
          'Search engine unavailable for suggest; degrading to postgres fallback',
        );
      }
    }

    const suggestions = await this.catalogService.suggestProductsPostgresFallback(q, limit);
    return {
      suggestions,
      mode: 'postgres',
    };
  }
}
