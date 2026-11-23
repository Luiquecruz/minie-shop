import { useCallback, useMemo } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { ONE_MINUTE_MS } from '../query/queryClient';
import { queryKeys } from '../query/queryKeys';
import { useProductRepository } from './useProductRepository';

interface FavoriteChanges {
  confirmed: string[];
  pending: Map<symbol, string>;
}

const favoriteChangesByClient = new WeakMap<QueryClient, FavoriteChanges>();

function projectFavorites({ confirmed, pending }: FavoriteChanges): string[] {
  const favorites = new Set(confirmed);
  for (const productId of pending.values()) {
    if (!favorites.delete(productId)) {
      favorites.add(productId);
    }
  }
  return [...favorites];
}

/**
 * Fetches persisted favorite product UUIDs from GET /favorites.
 */
export function useFavoritesQuery() {
  const queryClient = useQueryClient();
  const repository = useProductRepository();

  return useQuery({
    queryKey: queryKeys.favorites.all,
    staleTime: ONE_MINUTE_MS,
    queryFn: async ({ signal }) => {
      const changes = favoriteChangesByClient.get(queryClient);
      if (changes) {
        return projectFavorites(changes);
      }
      const response = await repository.getFavorites(signal);
      return response.productIds;
    },
  });
}

interface ToggleFavoriteVariables {
  productId: string;
  currentlyFavorited: boolean;
}

/**
 * Toggles a product favorite via POST / DELETE /favorites/:productId with
 * optimistic cache updates, automatic rollback on error, and minimal invalidation.
 */
export function useToggleFavoriteMutation(
  onFavoriteError?: (error: Error) => void,
) {
  const queryClient = useQueryClient();
  const repository = useProductRepository();
  const favoritesKey = queryKeys.favorites.all;

  return useMutation<boolean, Error, ToggleFavoriteVariables, symbol>({
    scope: { id: 'favorites' },
    mutationFn: async ({ productId, currentlyFavorited }) => {
      if (currentlyFavorited) {
        await repository.removeFavorite(productId);
        return false;
      }
      await repository.addFavorite(productId);
      return true;
    },
    onMutate: async ({ productId }) => {
      await queryClient.cancelQueries({ queryKey: favoritesKey });

      let changes = favoriteChangesByClient.get(queryClient);
      if (!changes) {
        changes = {
          confirmed: queryClient.getQueryData<string[]>(favoritesKey) ?? [],
          pending: new Map(),
        };
        favoriteChangesByClient.set(queryClient, changes);
      }

      const change = Symbol();
      changes.pending.set(change, productId);
      queryClient.setQueryData(favoritesKey, projectFavorites(changes));
      return change;
    },
    onSettled: (nextFavorited, error, variables, change) => {
      const changes = favoriteChangesByClient.get(queryClient);
      if (changes && change !== undefined) {
        if (!error && nextFavorited !== undefined) {
          const nextConfirmed = new Set(changes.confirmed);
          if (nextFavorited) {
            nextConfirmed.add(variables.productId);
          } else {
            nextConfirmed.delete(variables.productId);
          }
          changes.confirmed = [...nextConfirmed];
        }
        changes.pending.delete(change);
        queryClient.setQueryData(favoritesKey, projectFavorites(changes));

        if (changes.pending.size === 0) {
          favoriteChangesByClient.delete(queryClient);
          void queryClient.invalidateQueries({ queryKey: favoritesKey });
        }
      }

      if (error) {
        onFavoriteError?.(error);
      }
    },
  });
}

/**
 * Convenience facade exposing favorite UUIDs, lookup helper, optimistic toggle, and error state.
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
    (productId: string): boolean => favoriteSet.has(productId),
    [favoriteSet],
  );

  const toggleFavorite = useCallback(
    (productId: string): void => {
      mutation.mutate({
        productId,
        currentlyFavorited: favoriteSet.has(productId),
      });
    },
    [mutation, favoriteSet],
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
