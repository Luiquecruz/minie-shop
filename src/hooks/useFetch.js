import { useState, useEffect } from 'react';

/**
 * Custom hook for data fetching with AbortController, debouncing, and effect cleanup.
 * Prevents race conditions and out-of-order responses by aborting stale requests.
 *
 * @param {Function} fetcher - Async function taking (query, { signal }) and returning data
 * @param {string} query - The search query term
 * @param {Object} [options]
 * @param {number} [options.debounceMs=300] - Debounce delay in milliseconds
 * @param {number} [options.minQueryLength=1] - Minimum length required to trigger search
 * @param {Array} [options.initialData=[]] - Initial state for data
 * @returns {{ data: any[], isLoading: boolean, error: Error|null, isDebouncing: boolean }}
 */
export function useFetch(
  fetcher,
  query,
  { debounceMs = 300, minQueryLength = 1, initialData = [] } = {},
) {
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const trimmedQuery = (query || '').trim();
  const shouldFetch = trimmedQuery.length >= minQueryLength;

  useEffect(() => {
    if (!shouldFetch) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetcher(trimmedQuery, { signal });
        if (!signal.aborted) {
          setData(result);
          setIsLoading(false);
        }
      } catch (err) {
        // If aborted, silently ignore to avoid out-of-order state updates
        if (err.name === 'AbortError' || signal.aborted) {
          return;
        }
        setError(err);
        setIsLoading(false);
      }
    }, debounceMs);

    // Cleanup cancels pending debounce timer and aborts active in-flight request
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fetcher, trimmedQuery, shouldFetch, debounceMs]);

  // Derived data: if query is empty or below threshold, provide initialData
  const activeData = shouldFetch ? data : initialData;

  return {
    data: activeData,
    isLoading: shouldFetch && isLoading,
    error: shouldFetch ? error : null,
  };
}

export default useFetch;
