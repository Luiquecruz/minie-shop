import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../query/queryKeys';
import { productsApi } from '../services/api';

interface ToggleFavoriteContext {
  previousFavorites: number[];
}

/**
 * Fetches persisted favorite product IDs.
 */
export function useFavoritesQuery() {
  return useQuery({
    queryKey: queryKeys.favorites.all,
    queryFn: ({ signal }) => productsApi.getFavorites(100, signal),
  });
}

/**
 * Toggles a product in favorites using optimistic cache updates,
 * automatic rollback on error, and targeted list invalidation.
 */
export function useToggleFavoriteMutation() {
  const queryClient = useQueryClient();

  return useMutation<number[], Error, number, ToggleFavoriteContext>({
    mutationFn: (productId) => productsApi.toggleFavorite(productId),
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.favorites.all });

      const previousFavorites =
        queryClient.getQueryData<number[]>(queryKeys.favorites.all) ?? [];

      const nextFavorites = previousFavorites.includes(productId)
        ? previousFavorites.filter((id) => id !== productId)
        : [...previousFavorites, productId];

      queryClient.setQueryData<number[]>(queryKeys.favorites.all, nextFavorites);

      return { previousFavorites };
    },
    onError: (_error, _productId, context) => {
      if (context) {
        queryClient.setQueryData<number[]>(
          queryKeys.favorites.all,
          context.previousFavorites,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all });
      // Only invalidate Favorites-filtered catalog lists so normal catalog pages stay cached
      void queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
        predicate: (query) => {
          const maybeFilters = query.queryKey[2];
          return (
            typeof maybeFilters === 'object' &&
            maybeFilters !== null &&
            'favoritesOnly' in maybeFilters &&
            maybeFilters.favoritesOnly === true
          );
        },
      });
    },
  });
}

/**
 * Convenience facade exposing favorite IDs, lookup helper, optimistic toggle, and error state.
 */
export function useFavorites() {
  const favoritesQuery = useFavoritesQuery();
  const mutation = useToggleFavoriteMutation();

  const favoriteIds = useMemo(
    () => favoritesQuery.data ?? [],
    [favoritesQuery.data],
  );

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const isFavorite = useCallback(
    (productId: number): boolean => favoriteSet.has(productId),
    [favoriteSet],
  );

  const toggleFavorite = useCallback(
    (productId: number): void => {
      mutation.mutate(productId);
    },
    [mutation],
  );

  return {
    favoriteIds,
    favoritesCount: favoriteIds.length,
    isFavorite,
    toggleFavorite,
    isPending: mutation.isPending,
    error: mutation.error,
    resetError: mutation.reset,
  };
}

export default useFavorites;
