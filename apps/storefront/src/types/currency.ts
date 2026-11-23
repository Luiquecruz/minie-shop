/**
 * Supported ISO currency codes in Minie Shop.
 */
export type CurrencyCode = 'BRL' | 'USD' | 'EUR';

/**
 * Configuration metadata for a supported currency.
 */
export interface CurrencyConfig {
  code: CurrencyCode;
  label: string;
  symbol: string;
  rate: number;
  locale: string;
}
