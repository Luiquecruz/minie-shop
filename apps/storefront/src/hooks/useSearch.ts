import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MAX_SUGGEST_LIMIT } from '../domain/repositories/ProductRepository';
import { queryKeys } from '../query/queryKeys';
import { useProductRepository } from './useProductRepository';

const SUGGEST_STALE_TIME_MS = 30 * 1000;
export const MIN_SUGGEST_QUERY_LENGTH = 2;

/**
 * Fetches fast lexical autocomplete suggestions (max 8) with AbortSignal
 * cancellation, short staleTime, and previous suggestions kept visible
 * while the next query loads.
 */
export function useSearchSuggestQuery(
  query: string,
  enabled: boolean = true,
  limit: number = MAX_SUGGEST_LIMIT,
) {
  const repository = useProductRepository();
  const trimmed = query.trim();
  const cappedLimit = Math.min(MAX_SUGGEST_LIMIT, Math.max(1, limit));

  return useQuery({
    queryKey: queryKeys.search.suggest(trimmed, cappedLimit),
    queryFn: ({ signal }) =>
      repository.suggestProducts({ q: trimmed, limit: cappedLimit }, signal),
    enabled: enabled && trimmed.length >= MIN_SUGGEST_QUERY_LENGTH,
    staleTime: SUGGEST_STALE_TIME_MS,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
