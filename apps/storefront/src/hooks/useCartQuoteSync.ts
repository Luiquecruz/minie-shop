import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PricingQuoteResponseDTO, SupportedCurrency } from '@minieshop/contracts';
import { FIVE_MINUTES_MS } from '../query/queryClient';
import { queryKeys } from '../query/queryKeys';
import { useAppSelector } from '../store/hooks';
import {
  selectCartItems,
  selectCartShippingPricing,
  selectLastQuoteUpdatedAt,
} from '../store/selectors/cartSelectors';
import { useCartActions } from './useCart';
import { useCurrency } from './useCurrency';
import { useProductRepository } from './useProductRepository';

export const CART_QUOTE_TTL_MS = FIVE_MINUTES_MS;

interface ScopedQuoteResult {
  quote: PricingQuoteResponseDTO;
  currency: SupportedCurrency;
  productIdsKey: string;
}

export interface UseCartQuoteSyncResult {
  isQuoting: boolean;
  hasCurrencyMismatch: boolean;
  isTotalsLoading: boolean;
  quoteError: string | null;
  retryQuote: () => void;
  isItemPriceLoading: (itemCurrency: string) => boolean;
}

/**
 * Progressive, lazy + TTL-based cart repricing hook (ADR-0018).
 *
 * - Never fires while `active` is false (e.g., MiniCart closed) or cart is empty.
 * - Revalidates on currency mismatch, when the 5-minute cart quote cache TTL
 *   expires (active-only interval), or once if a fresh cache entry predates a
 *   newer applied quote stored in Redux (`lastQuoteUpdatedAt`).
 * - Stops automatic retries on error (manual Retry remains enabled).
 */
export function useCartQuoteSync(active: boolean): UseCartQuoteSyncResult {
  const repository = useProductRepository();
  const { currentCurrency } = useCurrency();
  const items = useAppSelector(selectCartItems);
  const shippingPricing = useAppSelector(selectCartShippingPricing);
  const lastQuoteUpdatedAt = useAppSelector(selectLastQuoteUpdatedAt);
  const { applyCartQuote } = useCartActions();

  const attemptedStaleRefreshKeyRef = useRef<string | null>(null);

  const productIds = useMemo(
    () => items.map((item) => item.id).sort(),
    [items],
  );
  const productIdsKey = productIds.join(',');
  const snapshotKey = `${currentCurrency}|${productIdsKey}`;

  const hasCurrencyMismatch = useMemo(
    () =>
      items.some((item) => item.price.currency !== currentCurrency) ||
      (items.length > 0 && shippingPricing.currency !== currentCurrency),
    [items, currentCurrency, shippingPricing.currency],
  );

  const shouldEnable = active && productIds.length > 0;

  const {
    data,
    dataUpdatedAt,
    isFetching,
    isError,
    refetch,
  } = useQuery<ScopedQuoteResult>({
    queryKey: queryKeys.pricing.quote(currentCurrency, productIds),
    queryFn: async ({ signal }) => {
      const quote = await repository.quotePricing(
        {
          currency: currentCurrency,
          productIds,
        },
        signal,
      );
      return {
        quote,
        currency: currentCurrency,
        productIdsKey,
      };
    },
    enabled: shouldEnable,
    staleTime: CART_QUOTE_TTL_MS,
    refetchInterval: shouldEnable ? CART_QUOTE_TTL_MS : false,
    retry: false,
  });

  useEffect(() => {
    if (!shouldEnable || !data) {
      return;
    }

    if (
      data.currency !== currentCurrency ||
      data.productIdsKey !== productIdsKey ||
      data.quote.currency !== currentCurrency
    ) {
      return;
    }

    // Reject older cached observations across mounts (e.g., MiniCart close/reopen
    // after [A,B] updated A) and trigger at most one fresh refetch unless errored.
    if (dataUpdatedAt < lastQuoteUpdatedAt) {
      if (
        !isFetching &&
        !isError &&
        attemptedStaleRefreshKeyRef.current !== snapshotKey
      ) {
        attemptedStaleRefreshKeyRef.current = snapshotKey;
        void refetch();
      }
      return;
    }

    attemptedStaleRefreshKeyRef.current = null;
    applyCartQuote({ quote: data.quote, updatedAt: dataUpdatedAt });
  }, [
    shouldEnable,
    data,
    dataUpdatedAt,
    isFetching,
    isError,
    refetch,
    currentCurrency,
    productIdsKey,
    snapshotKey,
    lastQuoteUpdatedAt,
    applyCartQuote,
  ]);

  const retryQuote = useCallback((): void => {
    attemptedStaleRefreshKeyRef.current = null;
    void refetch();
  }, [refetch]);

  const isQuoting = shouldEnable && isFetching;
  const isTotalsLoading = isQuoting && hasCurrencyMismatch;

  const isItemPriceLoading = useCallback(
    (itemCurrency: string): boolean =>
      isQuoting && itemCurrency !== currentCurrency,
    [isQuoting, currentCurrency],
  );

  const quoteError =
    shouldEnable && isError
      ? 'Could not refresh cart prices for the selected currency.'
      : null;

  return {
    isQuoting,
    hasCurrencyMismatch,
    isTotalsLoading,
    quoteError,
    retryQuote,
    isItemPriceLoading,
  };
}
