import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  CartCrossSellResponseDTO,
  ProductRecommendationsResponseDTO,
  RecommendationType,
} from '@minieshop/contracts';
import { MAX_CROSS_SELL_PRODUCT_IDS } from '../domain/repositories/ProductRepository';
import { FIVE_MINUTES_MS } from '../query/queryClient';
import { queryKeys } from '../query/queryKeys';
import { useProductRepository } from './useProductRepository';

export interface UseProductRecommendationsOptions {
  slug: string | undefined;
  types?: readonly RecommendationType[];
  limit?: number;
  enabled?: boolean;
}

const DEFAULT_PDP_TYPES: readonly RecommendationType[] = ['related', 'upsell'];

/**
 * Fetches PDP recommendations (`related`, `upsell`, etc.) in a single request.
 * Relies on QueryClient's `shouldRetryQuery` (network/5xx retries only), 5-min
 * staleTime, and keeps previous data during parameter transitions.
 */
export function useProductRecommendationsQuery({
  slug,
  types = DEFAULT_PDP_TYPES,
  limit,
  enabled = true,
}: UseProductRecommendationsOptions) {
  const repository = useProductRepository();
  const normalizedTypes = Array.from(new Set(types));

  return useQuery<ProductRecommendationsResponseDTO>({
    queryKey: queryKeys.recommendations.product(slug ?? '', normalizedTypes, limit),
    queryFn: ({ signal }) => {
      if (!slug) {
        return Promise.reject(new Error('Product slug is missing.'));
      }
      return repository.getProductRecommendations(
        {
          slug,
          types: normalizedTypes,
          limit,
        },
        signal,
      );
    },
    enabled: enabled && Boolean(slug),
    staleTime: FIVE_MINUTES_MS,
    placeholderData: keepPreviousData,
  });
}

export interface UseCartCrossSellOptions {
  productIds: readonly string[];
  limit?: number;
  enabled?: boolean;
}

/**
 * Fetches aggregated cross-sell recommendations for up to 20 cart product IDs.
 * Keeps previous items visible while cart changes trigger a fresh query so the UI
 * never flashes skeletons.
 */
export function useCartCrossSellQuery({
  productIds,
  limit = 6,
  enabled = true,
}: UseCartCrossSellOptions) {
  const repository = useProductRepository();
  const boundedIds = Array.from(
    new Set(productIds.map((id) => id.trim()).filter(Boolean)),
  ).slice(0, MAX_CROSS_SELL_PRODUCT_IDS);

  return useQuery<CartCrossSellResponseDTO>({
    queryKey: queryKeys.recommendations.crossSell(boundedIds, limit),
    queryFn: ({ signal }) =>
      repository.getCrossSell(
        {
          productIds: boundedIds,
          limit,
        },
        signal,
      ),
    enabled: enabled && boundedIds.length > 0,
    staleTime: FIVE_MINUTES_MS,
    placeholderData: keepPreviousData,
  });
}
