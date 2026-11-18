import type { Product, ProductSortOption } from './product';

/**
 * Query parameters for `productsApi.getProducts`.
 */
export interface GetProductsParams {
  category?: string;
  search?: string;
  sortBy?: ProductSortOption;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
  delayMs?: number;
}

/**
 * Paginated catalog response returned by `productsApi.getProducts`.
 */
export interface PaginatedProductsResponse {
  products: Product[];
  total: number;
  page?: number;
  totalPages?: number;
}

/**
 * Query parameters for `productsApi.searchProducts`.
 */
export interface SearchProductsParams {
  query?: string;
  limit?: number;
  signal?: AbortSignal;
  delayMs?: number;
}

/**
 * Result returned by `productsApi.validateStock`.
 */
export interface StockValidationResult {
  available: boolean;
  maxStock: number;
  message: string | null;
}

/**
 * Discriminated union representing page-level asynchronous request states.
 */
export type AsyncRequestState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };
