import { z } from 'zod';

export const MAX_SEARCH_QUERY_LENGTH = 200;

export const searchQueryParamSchema = z
  .string()
  .trim()
  .max(MAX_SEARCH_QUERY_LENGTH);

/**
 * Parses and normalizes `?q=` from URLSearchParams with Zod (trim + length cap).
 */
export function parseSearchUrlQuery(searchParams: URLSearchParams): string {
  const raw = searchParams.get('q');
  if (!raw) {
    return '';
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return '';
  }
  const parsed = searchQueryParamSchema.safeParse(trimmed);
  if (parsed.success) {
    return parsed.data;
  }
  return trimmed.slice(0, MAX_SEARCH_QUERY_LENGTH);
}

/**
 * Serializes a search query into canonical URLSearchParams for `/search`.
 */
export function serializeSearchUrlQuery(query: string): URLSearchParams {
  const params = new URLSearchParams();
  const normalized = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  if (normalized.length > 0) {
    params.set('q', normalized);
  }
  return params;
}
