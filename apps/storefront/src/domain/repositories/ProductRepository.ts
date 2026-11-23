import type {
  CategoriesResponseDTO,
  FacetsDTO,
  FavoriteCreatedResponseDTO,
  FavoritesListResponseDTO,
  ProductDetailDTO,
  ProductListResponseDTO,
  ProductSort,
} from '@minieshop/contracts';

export interface NumericAttributeRangeFilter {
  min?: number;
  max?: number;
}

export interface CatalogFilterParams {
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

/**
 * Domain repository port for all public catalog & favorites operations.
 */
export interface ProductRepository {
  listProducts(
    params?: ListProductsParams,
    signal?: AbortSignal,
  ): Promise<ProductListResponseDTO>;
  getProductBySlug(slug: string, signal?: AbortSignal): Promise<ProductDetailDTO>;
  getCategories(signal?: AbortSignal): Promise<CategoriesResponseDTO>;
  getFacets(params?: FacetsParams, signal?: AbortSignal): Promise<FacetsDTO>;
  getFavorites(signal?: AbortSignal): Promise<FavoritesListResponseDTO>;
  addFavorite(
    productId: string,
    signal?: AbortSignal,
  ): Promise<FavoriteCreatedResponseDTO>;
  removeFavorite(productId: string, signal?: AbortSignal): Promise<void>;
}

/**
 * Builds canonical API query string for GET /products and GET /products/facets.
 */
export function buildCatalogQueryString(
  params: ListProductsParams = {},
  mode: 'list' | 'facets' = 'list',
): string {
  const search = new URLSearchParams();

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
