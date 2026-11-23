import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import type { CatalogFilterParams } from '../domain/repositories/ProductRepository';
import {
  FIVE_MINUTES_MS,
  TWO_MINUTES_MS,
} from '../query/queryClient';
import {
  queryKeys,
  type ProductInfiniteFilters,
} from '../query/queryKeys';
import { useProductRepository } from './useProductRepository';

const THIRTY_SECONDS_MS = 30 * 1000;

/**
 * Fetches cursor-paginated, filtered, and sorted catalog products via
 * `useInfiniteQuery` with `placeholderData: keepPreviousData` so filter
 * transitions never flash blank skeletons.
 */
export function useProductsQuery(filters: ProductInfiniteFilters) {
  const repository = useProductRepository();

  return useInfiniteQuery({
    queryKey: queryKeys.products.infinite(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      repository.listProducts(
        {
          ...filters,
          cursor: pageParam,
        },
        signal,
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: TWO_MINUTES_MS,
  });
}

/**
 * Fetches the hierarchical category tree with a 5-minute staleTime.
 * Omits `signal` intentionally so TanStack Query deduplicates this static global
 * fetch across React StrictMode remounts instead of aborting and re-fetching it.
 */
export function useCategoriesQuery() {
  const repository = useProductRepository();

  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => repository.getCategories(),
    staleTime: FIVE_MINUTES_MS,
  });
}

/**
 * Fetches disjunctive catalog facets matching the active filters.
 */
export function useFacetsQuery(filters: CatalogFilterParams) {
  const repository = useProductRepository();

  return useQuery({
    queryKey: queryKeys.products.facets(filters),
    queryFn: ({ signal }) => repository.getFacets(filters, signal),
    placeholderData: keepPreviousData,
    staleTime: TWO_MINUTES_MS,
  });
}

/**
 * Fetches a single product detail by slug.
 */
export function useProductQuery(slug: string | undefined) {
  const repository = useProductRepository();

  return useQuery({
    queryKey: queryKeys.products.detail(slug ?? ''),
    queryFn: ({ signal }) => {
      if (!slug) {
        return Promise.reject(new Error('Product slug is missing.'));
      }
      return repository.getProductBySlug(slug, signal);
    },
    enabled: Boolean(slug),
    staleTime: TWO_MINUTES_MS,
  });
}

export interface StockValidationResult {
  available: boolean;
  maxStock: number;
  message: string | null;
}

/**
 * Validates product availability (`inStock`) through the catalog repository
 * when cart item quantities are edited.
 */
export function useStockValidationQuery(
  slug: string,
  debouncedQuantity: number,
  enabled: boolean,
) {
  const repository = useProductRepository();

  return useQuery<StockValidationResult>({
    queryKey: queryKeys.products.stock(slug, debouncedQuantity),
    queryFn: async ({ signal }) => {
      const detail = await repository.getProductBySlug(slug, signal);
      return {
        available: detail.inStock,
        maxStock: detail.inStock ? 99 : 0,
        message: detail.inStock
          ? null
          : 'This product is currently out of stock.',
      };
    },
    enabled: enabled && Boolean(slug) && debouncedQuantity >= 1,
    staleTime: THIRTY_SECONDS_MS,
    retry: 0,
  });
}
