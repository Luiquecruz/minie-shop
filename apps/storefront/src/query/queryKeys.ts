import type { RecommendationType, SupportedCurrency } from '@minieshop/contracts';
import type {
  CatalogFilterParams,
  ListProductsParams,
} from '../domain/repositories/ProductRepository';

export type ProductInfiniteFilters = Omit<ListProductsParams, 'cursor'>;

function normalizeRecord<T>(
  record?: Record<string, T>,
): Record<string, T> | undefined {
  if (!record) return undefined;
  const entries = Object.entries(record).sort(([a], [b]) => a.localeCompare(b));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function normalizeCatalogFilters(
  filters: CatalogFilterParams = {},
): CatalogFilterParams {
  return {
    currency: filters.currency ?? 'BRL',
    category: filters.category || undefined,
    q: filters.q?.trim() || undefined,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    inStock: filters.inStock,
    attributes: normalizeRecord(
      filters.attributes
        ? Object.fromEntries(
            Object.entries(filters.attributes)
              .map(([code, vals]) => [code, [...vals].sort()] as const)
              .filter(([, vals]) => vals.length > 0),
          )
        : undefined,
    ),
    numericAttributes: normalizeRecord(filters.numericAttributes),
  };
}

/**
 * Centralized, strongly-typed React Query key factory.
 */
export const queryKeys = {
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    infinite: (filters: ProductInfiniteFilters) =>
      [
        ...queryKeys.products.lists(),
        {
          ...normalizeCatalogFilters(filters),
          sort: filters.sort ?? 'newest',
          limit: filters.limit ?? 12,
        },
      ] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (slug: string, currency: SupportedCurrency = 'BRL') =>
      [...queryKeys.products.details(), slug, currency] as const,
    facets: (filters: CatalogFilterParams = {}) =>
      [...queryKeys.products.all, 'facets', normalizeCatalogFilters(filters)] as const,
    stock: (slug: string, quantity: number) =>
      [...queryKeys.products.all, 'stock', slug, quantity] as const,
  },
  search: {
    all: ['search'] as const,
    suggest: (q: string, limit: number = 8) =>
      [...queryKeys.search.all, 'suggest', q.trim(), limit] as const,
  },
  recommendations: {
    all: ['recommendations'] as const,
    product: (
      slug: string,
      types: readonly RecommendationType[] = ['related', 'upsell'],
      limit?: number,
      currency: SupportedCurrency = 'BRL',
    ) =>
      [
        ...queryKeys.recommendations.all,
        'product',
        slug,
        currency,
        [...types].sort(),
        limit ?? null,
      ] as const,
    crossSell: (
      productIds: readonly string[],
      limit: number = 6,
      currency: SupportedCurrency = 'BRL',
    ) =>
      [
        ...queryKeys.recommendations.all,
        'cross-sell',
        currency,
        Array.from(
          new Set(productIds.map((id) => id.trim().toLowerCase()).filter(Boolean)),
        ),
        limit,
      ] as const,
  },
  pricing: {
    all: ['pricing'] as const,
    quote: (currency: SupportedCurrency, productIds: readonly string[]) =>
      [...queryKeys.pricing.all, 'quote', currency, [...productIds].sort()] as const,
  },
  categories: {
    all: ['categories'] as const,
  },
  favorites: {
    all: ['favorites'] as const,
  },
} as const;
