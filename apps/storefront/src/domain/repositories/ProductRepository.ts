import {
  MAX_PRICING_QUOTE_PRODUCT_IDS,
  type CartCrossSellResponseDTO,
  type CategoriesResponseDTO,
  type FacetsDTO,
  type FavoriteCreatedResponseDTO,
  type FavoritesListResponseDTO,
  type PricingQuoteRequestDTO,
  type PricingQuoteResponseDTO,
  type ProductDetailDTO,
  type ProductListResponseDTO,
  type ProductRecommendationsResponseDTO,
  type ProductSort,
  type RecommendationType,
  type SearchRequestedMode,
  type SearchResponseDTO,
  type SearchSuggestResponseDTO,
  type SupportedCurrency,
} from '@minieshop/contracts';

export const DEFAULT_SEARCH_LIMIT = 12;
export const SEARCH_PAGE_SIZE = 24;
export const MAX_SEARCH_LIMIT = 60;
export const MAX_SEARCH_OFFSET = 200;
export const MAX_SUGGEST_LIMIT = 8;
export const MAX_RECOMMENDATION_LIMIT = 12;
export const MAX_CROSS_SELL_PRODUCT_IDS = 20;

export interface NumericAttributeRangeFilter {
  min?: number;
  max?: number;
}

export interface CatalogFilterParams {
  currency?: SupportedCurrency;
  category?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  /**
   * Discrete attribute filters keyed by attribute code (`attr.<code>=v1,v2`).
   */
  attributes?: Record<string, string[]>;
  /**
   * Numeric attribute range filters keyed by attribute code (`attr.<code>.min` / `.max`).
   */
  numericAttributes?: Record<string, NumericAttributeRangeFilter>;
}

export interface ListProductsParams extends CatalogFilterParams {
  sort?: ProductSort;
  limit?: number;
  cursor?: string;
}

export type FacetsParams = CatalogFilterParams;

export interface SearchProductsParams {
  q: string;
  limit?: number;
  offset?: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  mode?: SearchRequestedMode;
}

export interface SuggestProductsParams {
  q: string;
  limit?: number;
}

export interface ProductRecommendationsParams {
  slug: string;
  types?: RecommendationType[];
  limit?: number;
  currency?: SupportedCurrency;
}

export interface CrossSellParams {
  productIds: string[];
  limit?: number;
  currency?: SupportedCurrency;
}

/**
 * Domain repository port for all public catalog, pricing, search,
 * recommendations & favorites operations.
 */
export interface ProductRepository {
  listProducts(
    params?: ListProductsParams,
    signal?: AbortSignal,
  ): Promise<ProductListResponseDTO>;
  getProductBySlug(
    slug: string,
    signal?: AbortSignal,
    currency?: SupportedCurrency,
  ): Promise<ProductDetailDTO>;
  getCategories(signal?: AbortSignal): Promise<CategoriesResponseDTO>;
  getFacets(params?: FacetsParams, signal?: AbortSignal): Promise<FacetsDTO>;
  quotePricing(
    request: PricingQuoteRequestDTO,
    signal?: AbortSignal,
  ): Promise<PricingQuoteResponseDTO>;
  getFavorites(signal?: AbortSignal): Promise<FavoritesListResponseDTO>;
  addFavorite(
    productId: string,
    signal?: AbortSignal,
  ): Promise<FavoriteCreatedResponseDTO>;
  removeFavorite(productId: string, signal?: AbortSignal): Promise<void>;
  searchProducts(
    params: SearchProductsParams,
    signal?: AbortSignal,
  ): Promise<SearchResponseDTO>;
  suggestProducts(
    params: SuggestProductsParams,
    signal?: AbortSignal,
  ): Promise<SearchSuggestResponseDTO>;
  getProductRecommendations(
    params: ProductRecommendationsParams,
    signal?: AbortSignal,
  ): Promise<ProductRecommendationsResponseDTO>;
  getCrossSell(
    params: CrossSellParams,
    signal?: AbortSignal,
  ): Promise<CartCrossSellResponseDTO>;
}

/**
 * Builds canonical API query string for GET /products and GET /products/facets.
 */
export function buildCatalogQueryString(
  params: ListProductsParams = {},
  mode: 'list' | 'facets' = 'list',
): string {
  const search = new URLSearchParams();

  if (params.currency && params.currency !== 'BRL') {
    search.set('currency', params.currency);
  }
  if (params.category) {
    search.set('category', params.category);
  }
  if (params.q && params.q.trim().length > 0) {
    search.set('q', params.q.trim());
  }
  if (params.minPrice !== undefined) {
    search.set('minPrice', String(Math.trunc(params.minPrice)));
  }
  if (params.maxPrice !== undefined) {
    search.set('maxPrice', String(Math.trunc(params.maxPrice)));
  }
  if (params.inStock !== undefined) {
    search.set('inStock', String(params.inStock));
  }

  if (params.attributes) {
    const sortedCodes = Object.keys(params.attributes).sort();
    for (const code of sortedCodes) {
      const values = params.attributes[code]
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      if (values.length > 0) {
        search.set(`attr.${code}`, Array.from(new Set(values)).join(','));
      }
    }
  }

  if (params.numericAttributes) {
    const sortedCodes = Object.keys(params.numericAttributes).sort();
    for (const code of sortedCodes) {
      const range = params.numericAttributes[code];
      if (range.min !== undefined && Number.isFinite(range.min)) {
        search.set(`attr.${code}.min`, String(range.min));
      }
      if (range.max !== undefined && Number.isFinite(range.max)) {
        search.set(`attr.${code}.max`, String(range.max));
      }
    }
  }

  if (mode === 'list') {
    if (params.sort) {
      if (params.sort !== 'relevance' || (params.q && params.q.trim().length > 0)) {
        search.set('sort', params.sort);
      }
    }
    if (params.limit !== undefined) {
      search.set('limit', String(Math.trunc(params.limit)));
    }
    if (params.cursor) {
      search.set('cursor', params.cursor);
    }
  }

  const serialized = search.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
}

/**
 * Builds canonical query string for GET /search.
 */
export function buildSearchQueryString(params: SearchProductsParams): string {
  const search = new URLSearchParams();
  search.set('q', params.q.trim());

  if (params.limit !== undefined) {
    search.set('limit', String(Math.trunc(params.limit)));
  }
  if (params.offset !== undefined) {
    search.set('offset', String(Math.trunc(params.offset)));
  }
  if (params.category) {
    search.set('category', params.category);
  }
  if (params.minPrice !== undefined) {
    search.set('minPrice', String(Math.trunc(params.minPrice)));
  }
  if (params.maxPrice !== undefined) {
    search.set('maxPrice', String(Math.trunc(params.maxPrice)));
  }
  if (params.inStock !== undefined) {
    search.set('inStock', String(params.inStock));
  }
  if (params.mode) {
    search.set('mode', params.mode);
  }

  return `?${search.toString()}`;
}

/**
 * Builds canonical query string for GET /search/suggest.
 */
export function buildSuggestQueryString(params: SuggestProductsParams): string {
  const search = new URLSearchParams();
  search.set('q', params.q.trim());

  if (params.limit !== undefined) {
    search.set('limit', String(Math.trunc(params.limit)));
  }

  return `?${search.toString()}`;
}

/**
 * Builds canonical query string for GET /products/:slug/recommendations.
 */
export function buildProductRecommendationsQueryString(
  params: Omit<ProductRecommendationsParams, 'slug'>,
): string {
  const search = new URLSearchParams();

  if (params.currency && params.currency !== 'BRL') {
    search.set('currency', params.currency);
  }
  if (params.types && params.types.length > 0) {
    const uniqueTypes = Array.from(new Set(params.types));
    search.set('types', uniqueTypes.join(','));
  }
  if (params.limit !== undefined) {
    search.set('limit', String(Math.trunc(params.limit)));
  }

  const serialized = search.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
}

/**
 * Builds canonical query string for GET /recommendations/cross-sell.
 */
export function buildCrossSellQueryString(params: CrossSellParams): string {
  const search = new URLSearchParams();
  const uniqueIds = Array.from(
    new Set(params.productIds.map((id) => id.trim()).filter(Boolean)),
  ).slice(0, MAX_CROSS_SELL_PRODUCT_IDS);

  search.set('productIds', uniqueIds.join(','));

  if (params.currency && params.currency !== 'BRL') {
    search.set('currency', params.currency);
  }
  if (params.limit !== undefined) {
    search.set('limit', String(Math.trunc(params.limit)));
  }

  return `?${search.toString()}`;
}

/**
 * Quotes cart product IDs in batches honoring the server `MAX_PRICING_QUOTE_PRODUCT_IDS` limit.
 * Normalizes and deduplicates UUIDs to lowercase before issuing batches and preserves single-call
 * behavior whenever the deduplicated list fits within `maxBatchSize`.
 */
export async function quotePricingInBatches(
  currency: SupportedCurrency,
  productIds: readonly string[],
  fetchBatch: (
    batchRequest: PricingQuoteRequestDTO,
  ) => Promise<PricingQuoteResponseDTO>,
  maxBatchSize: number = MAX_PRICING_QUOTE_PRODUCT_IDS,
): Promise<PricingQuoteResponseDTO> {
  const normalizedIds = Array.from(
    new Set(productIds.map((id) => id.toLowerCase())),
  );

  if (normalizedIds.length <= maxBatchSize) {
    return fetchBatch({
      currency,
      productIds: normalizedIds,
    });
  }

  const chunks: string[][] = [];
  for (let i = 0; i < normalizedIds.length; i += maxBatchSize) {
    chunks.push(normalizedIds.slice(i, i + maxBatchSize));
  }

  const batchResponses = await Promise.all(
    chunks.map((chunk) =>
      fetchBatch({
        currency,
        productIds: chunk,
      }),
    ),
  );

  const first = batchResponses[0];
  return {
    currency: first.currency,
    items: batchResponses.flatMap((batch) => batch.items),
    freeShippingThresholdCents: first.freeShippingThresholdCents,
    shippingOptions: first.shippingOptions,
  };
}
