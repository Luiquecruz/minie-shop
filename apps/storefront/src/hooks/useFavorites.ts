import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../query/queryKeys';
import { productsApi } from '../services/api';

interface FavoriteChanges {
  confirmed: number[];
  pending: Map<symbol, number>;
}

const favoriteChangesByClient = new WeakMap<QueryClient, FavoriteChanges>();

function projectFavorites({ confirmed, pending }: FavoriteChanges): number[] {
  const favorites = new Set(confirmed);
  for (const productId of pending.values()) {
    if (!favorites.delete(productId)) favorites.add(productId);
  }
  return [...favorites];
}

/**
 * Fetches persisted favorite product IDs.
 */
export function useFavoritesQuery() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.favorites.all,
    queryFn: ({ signal }) => {
      const changes = favoriteChangesByClient.get(queryClient);
      // A read during a toggle could already include its write. Reconcile after the queue drains.
      return changes ? projectFavorites(changes) : productsApi.getFavorites(100, signal);
    },
  });
}

/**
 * Toggles a product in favorites using optimistic cache updates,
 * automatic rollback on error, and targeted list invalidation.
 */
export function useToggleFavoriteMutation(onFavoriteError?: (error: Error) => void) {
  const queryClient = useQueryClient();
  const favoritesKey = queryKeys.favorites.all;

  return useMutation<number[], Error, number, symbol>({
    // Run writes in order so each full response can become the confirmed baseline.
    scope: { id: 'favorites' },
    mutationFn: (productId) => productsApi.toggleFavorite(productId),
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: favoritesKey });

      let changes = favoriteChangesByClient.get(queryClient);
      if (!changes) {
        changes = {
          confirmed: queryClient.getQueryData<number[]>(favoritesKey) ?? [],
          pending: new Map(),
        };
        favoriteChangesByClient.set(queryClient, changes);
      }

      const change = Symbol();
      changes.pending.set(change, productId);
      queryClient.setQueryData(favoritesKey, projectFavorites(changes));
      return change;
    },
    onSettled: (confirmed, error, _productId, change) => {
      const changes = favoriteChangesByClient.get(queryClient);
      if (changes && change !== undefined) {
        if (confirmed !== undefined) changes.confirmed = confirmed;
        changes.pending.delete(change);
        queryClient.setQueryData(favoritesKey, projectFavorites(changes));

        if (changes.pending.size === 0) {
          favoriteChangesByClient.delete(queryClient);
          void queryClient.invalidateQueries({ queryKey: favoritesKey });
        }
      }

      if (error) onFavoriteError?.(error);

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
export function useFavorites(onFavoriteError?: (error: Error) => void) {
  const favoritesQuery = useFavoritesQuery();
  const mutation = useToggleFavoriteMutation(onFavoriteError);

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
