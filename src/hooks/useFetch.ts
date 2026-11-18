import { useState, useEffect } from 'react';

export interface UseFetchFetcherOptions {
  signal: AbortSignal;
}

export type UseFetchFetcher<T> = (
  query: string,
  options: UseFetchFetcherOptions,
) => Promise<T>;

export interface UseFetchOptionsWithInitial<T> {
  debounceMs?: number;
  minQueryLength?: number;
  initialData: T;
}

export interface UseFetchOptionsOptional<T> {
  debounceMs?: number;
  minQueryLength?: number;
  initialData?: T;
}

export type AsyncFetchState<T> =
  | { status: 'idle'; data: T; error: null; isLoading: false }
  | { status: 'loading'; data: T; error: null; isLoading: true }
  | { status: 'success'; data: T; error: null; isLoading: false }
  | { status: 'error'; data: T; error: Error; isLoading: false };

/**
 * Custom hook for data fetching with AbortController, debouncing, and effect cleanup.
 * Prevents race conditions and out-of-order responses by aborting stale requests.
 */
export function useFetch<T>(
  fetcher: UseFetchFetcher<T>,
  query: string,
  options: UseFetchOptionsWithInitial<T>,
): AsyncFetchState<T>;

export function useFetch<T>(
  fetcher: UseFetchFetcher<T>,
  query: string,
  options?: UseFetchOptionsOptional<T>,
): AsyncFetchState<T | undefined>;

export function useFetch<T>(
  fetcher: UseFetchFetcher<T>,
  query: string,
  {
    debounceMs = 300,
    minQueryLength = 1,
    initialData,
  }: UseFetchOptionsOptional<T> = {},
): AsyncFetchState<T | undefined> {
  const [data, setData] = useState<T | undefined>(initialData);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);

  const trimmedQuery = (query || '').trim();
  const shouldFetch = trimmedQuery.length >= minQueryLength;

  useEffect(() => {
    if (!shouldFetch) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const timer = setTimeout(async () => {
      setStatus('loading');
      setError(null);

      try {
        const result = await fetcher(trimmedQuery, { signal });
        if (!signal.aborted) {
          setData(result);
          setStatus('success');
        }
      } catch (err: unknown) {
        // If aborted, silently ignore to avoid out-of-order state updates
        if (
          (err instanceof DOMException && err.name === 'AbortError') ||
          signal.aborted
        ) {
          return;
        }
        const normalizedError =
          err instanceof Error ? err : new Error(String(err));
        setError(normalizedError);
        setStatus('error');
      }
    }, debounceMs);

    // Cleanup cancels pending debounce timer and aborts active in-flight request
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fetcher, trimmedQuery, shouldFetch, debounceMs]);

  if (!shouldFetch) {
    return {
      status: 'idle',
      data: initialData,
      error: null,
      isLoading: false,
    };
  }

  if (status === 'loading') {
    return {
      status: 'loading',
      data,
      error: null,
      isLoading: true,
    };
  }

  if (status === 'success') {
    return {
      status: 'success',
      data,
      error: null,
      isLoading: false,
    };
  }

  if (status === 'error' && error !== null) {
    return {
      status: 'error',
      data,
      error,
      isLoading: false,
    };
  }

  return {
    status: 'idle',
    data: initialData,
    error: null,
    isLoading: false,
  };
}

export default useFetch;
