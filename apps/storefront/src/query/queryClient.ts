import { QueryClient } from '@tanstack/react-query';
import {
  ApiError,
  ContractViolationError,
  isAbortError,
} from '../infrastructure/http/errors';

export const TWO_MINUTES_MS = 2 * 60 * 1000;
export const FIVE_MINUTES_MS = 5 * 60 * 1000;
export const ONE_MINUTE_MS = 60 * 1000;
export const TEN_MINUTES_MS = 10 * 60 * 1000;

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isAbortError(error)) {
    return false;
  }
  if (error instanceof ApiError && error.isClientError) {
    return false;
  }
  if (error instanceof ContractViolationError) {
    return false;
  }
  return failureCount < 2;
}

export function createStorefrontQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: TWO_MINUTES_MS,
        gcTime: TEN_MINUTES_MS,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
        retryDelay: (attemptIndex) =>
          Math.min(1000 * 2 ** attemptIndex, 4000),
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export const queryClient = createStorefrontQueryClient();
