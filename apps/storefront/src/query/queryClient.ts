import { QueryClient } from '@tanstack/react-query';
import { ProductNotFoundError } from '../services/api';

const TWO_MINUTES_MS = 2 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * Shared TanStack Query client configured with caching, staleTime,
 * and smart retry policies across the entire storefront.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: TWO_MINUTES_MS,
      gcTime: TEN_MINUTES_MS,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ProductNotFoundError) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) =>
        Math.min(1000 * 2 ** attemptIndex, 4000),
    },
    mutations: {
      retry: 0,
    },
  },
});
