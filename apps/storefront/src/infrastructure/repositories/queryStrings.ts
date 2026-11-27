import {
  MAX_CROSS_SELL_PRODUCT_IDS,
  type CrossSellParams,
  type ListProductsParams,
  type ProductRecommendationsParams,
  type SearchProductsParams,
  type SuggestProductsParams,
} from '../../domain/repositories/ProductRepository';

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

  if (params.currency && params.currency !== 'BRL') {
    search.set('currency', params.currency);
  }
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
