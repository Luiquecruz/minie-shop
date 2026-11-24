import { useCallback } from 'react';
import { useI18n, type SupportedLocale } from '../i18n';
import type { CurrencyCode } from '../types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  selectCurrentCurrency,
  setCurrency as setCurrencyAction,
} from '../store/slices/currencySlice';
import { formatCents } from '../utils/money';

function resolveNumberFormatLocale(locale: SupportedLocale): string {
  return locale === 'pt-BR' ? 'pt-BR' : 'en-US';
}

/**
 * Exposes the active storefront currency (persisted via Redux + localStorage)
 * and formats integer cents at the UI display boundary with zero client-side
 * FX conversion, respecting the active i18n locale (`en-US` | `pt-BR`).
 */
export function useCurrency() {
  const dispatch = useAppDispatch();
  const currentCurrency = useAppSelector(selectCurrentCurrency);
  const { locale } = useI18n();
  const numberFormatLocale = resolveNumberFormatLocale(locale);

  const setCurrency = useCallback(
    (currency: CurrencyCode): void => {
      dispatch(setCurrencyAction(currency));
    },
    [dispatch],
  );

  const formatPrice = useCallback(
    (amountCents: number, currency: CurrencyCode = currentCurrency): string =>
      formatCents(amountCents, currency, numberFormatLocale),
    [currentCurrency, numberFormatLocale],
  );

  return {
    currentCurrency,
    setCurrency,
    formatPrice,
  };
}

export default useCurrency;
