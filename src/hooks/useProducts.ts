import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys, type ProductListFilters } from '../query/queryKeys';
import { productsApi } from '../services/api';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;
const THIRTY_SECONDS_MS = 30 * 1000;

/**
 * Fetches paginated, filtered, and sorted catalog products with
 * `keepPreviousData` so page transitions do not flash loading skeletons.
 */
export function useProductsQuery(filters: ProductListFilters) {
  return useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: ({ signal }) =>
      productsApi.getProducts({
        category: filters.category,
        sortBy: filters.sortBy || undefined,
        page: filters.page,
        limit: filters.limit,
        favoritesOnly: filters.favoritesOnly,
        delayMs: 220,
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetches catalog category names with a longer 5-minute staleTime.
 */
export function useCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: ({ signal }) => productsApi.getCategories(120, signal),
    staleTime: FIVE_MINUTES_MS,
  });
}

/**
 * Fetches a single product by route ID.
 */
export function useProductQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.products.detail(id ?? ''),
    queryFn: ({ signal }) => {
      if (!id) {
        return Promise.reject(new Error('Product ID is missing.'));
      }
      return productsApi.getProductById(id, 200, signal);
    },
    enabled: Boolean(id),
  });
}

/**
 * Fetches related products for a PDP once the main product category is resolved.
 */
export function useRelatedProductsQuery(
  productId: number | undefined,
  category: string | undefined,
  limit: number = 4,
) {
  return useQuery({
    queryKey: queryKeys.products.related(productId ?? 0, category ?? '', limit),
    queryFn: ({ signal }) =>
      productsApi.getRelatedProducts(
        productId ?? 0,
        category ?? '',
        limit,
        150,
        signal,
      ),
    enabled: Boolean(productId && category),
  });
}

/**
 * Searches products for SearchBar autocomplete with 1-minute cache per query term.
 */
export function useProductSearchQuery(
  debouncedQuery: string,
  limit: number = 6,
) {
  const trimmed = debouncedQuery.trim();
  return useQuery({
    queryKey: queryKeys.products.search(trimmed, limit),
    queryFn: ({ signal }) =>
      productsApi.searchProducts({
        query: trimmed,
        limit,
        delayMs: 200,
        signal,
      }),
    enabled: trimmed.length >= 1,
    staleTime: ONE_MINUTE_MS,
  });
}

/**
 * Validates requested cart item stock through React Query with abort support.
 */
export function useStockValidationQuery(
  productId: number,
  debouncedQuantity: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.products.stock(productId, debouncedQuantity),
    queryFn: ({ signal }) =>
      productsApi.validateStock(productId, debouncedQuantity, signal),
    enabled: enabled && debouncedQuantity >= 1,
    staleTime: THIRTY_SECONDS_MS,
    retry: 0,
  });
}
