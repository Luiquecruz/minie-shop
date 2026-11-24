import { useCallback } from 'react';
import type { CurrencyCode } from '../types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  selectCurrentCurrency,
  setCurrency as setCurrencyAction,
} from '../store/slices/currencySlice';
import { formatCents } from '../utils/money';

/**
 * Exposes the active storefront currency (persisted via Redux + localStorage)
 * and formats integer cents at the UI display boundary with zero client-side FX conversion.
 */
export function useCurrency() {
  const dispatch = useAppDispatch();
  const currentCurrency = useAppSelector(selectCurrentCurrency);

  const setCurrency = useCallback(
    (currency: CurrencyCode): void => {
      dispatch(setCurrencyAction(currency));
    },
    [dispatch],
  );

  const formatPrice = useCallback(
    (amountCents: number, currency: CurrencyCode = currentCurrency): string =>
      formatCents(amountCents, currency),
    [currentCurrency],
  );

  return {
    currentCurrency,
    setCurrency,
    formatPrice,
  };
}

export default useCurrency;
