import type { SupportedCurrency } from '@minieshop/contracts';

/**
 * Supported ISO currency codes in Minie Shop.
 */
export type CurrencyCode = SupportedCurrency;

/**
 * Display metadata for a supported currency (zero client-side FX rates).
 */
export interface CurrencyConfig {
  code: CurrencyCode;
  label: string;
  symbol: string;
  locale: string;
}
