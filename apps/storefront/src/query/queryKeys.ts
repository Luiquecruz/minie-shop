import type { ProductSortOption } from '../types';

export interface ProductListFilters {
  category?: string;
  sortBy?: ProductSortOption;
  page: number;
  limit: number;
  favoritesOnly?: boolean;
}

/**
 * Centralized, strongly-typed React Query key factory.
 */
export const queryKeys = {
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (filters: ProductListFilters) =>
      [...queryKeys.products.lists(), filters] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: number | string) =>
      [...queryKeys.products.details(), Number(id)] as const,
    related: (id: number | string, category: string, limit: number) =>
      [...queryKeys.products.all, 'related', Number(id), category, limit] as const,
    search: (query: string, limit: number) =>
      [
        ...queryKeys.products.all,
        'search',
        query.trim().toLowerCase(),
        limit,
      ] as const,
    stock: (id: number | string, quantity: number) =>
      [...queryKeys.products.all, 'stock', Number(id), quantity] as const,
  },
  categories: {
    all: ['categories'] as const,
  },
  favorites: {
    all: ['favorites'] as const,
  },
} as const;
