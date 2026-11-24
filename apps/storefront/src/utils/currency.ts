import type { CurrencyCode, CurrencyConfig } from '../types';

/**
 * Display metadata for supported storefront currencies.
 * Client-side currency conversion is intentionally forbidden (ADR-0017 / ADR-0018):
 * all monetary amounts come directly from the backend in integer cents.
 */
export const SUPPORTED_CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  BRL: {
    code: 'BRL',
    label: 'BRL (R$)',
    symbol: 'R$',
    locale: 'pt-BR',
  },
  USD: {
    code: 'USD',
    label: 'USD ($)',
    symbol: '$',
    locale: 'en-US',
  },
  EUR: {
    code: 'EUR',
    label: 'EUR (€)',
    symbol: '€',
    locale: 'de-DE',
  },
};

export const SUPPORTED_CURRENCY_LIST: readonly CurrencyConfig[] = [
  SUPPORTED_CURRENCIES.BRL,
  SUPPORTED_CURRENCIES.USD,
  SUPPORTED_CURRENCIES.EUR,
];

export const DEFAULT_CURRENCY: CurrencyCode = 'BRL';

/**
 * Type guard checking whether an arbitrary string is a supported CurrencyCode.
 */
export const isCurrencyCode = (value: string): value is CurrencyCode =>
  value === 'BRL' || value === 'USD' || value === 'EUR';
