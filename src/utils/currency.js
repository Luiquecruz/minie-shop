/**
 * Minie Shop Multi-Currency Engine
 * Supports BRL (base currency), USD, and EUR with conversion and localized formatting.
 */

export const SUPPORTED_CURRENCIES = {
  BRL: {
    code: 'BRL',
    label: 'BRL (R$)',
    symbol: 'R$',
    rate: 1.0, // Base catalog currency
    locale: 'pt-BR',
  },
  USD: {
    code: 'USD',
    label: 'USD ($)',
    symbol: '$',
    rate: 0.18, // 1 BRL = 0.18 USD (approx 1 USD ~ 5.55 BRL)
    locale: 'en-US',
  },
  EUR: {
    code: 'EUR',
    label: 'EUR (€)',
    symbol: '€',
    rate: 0.16, // 1 BRL = 0.16 EUR (approx 1 EUR ~ 6.25 BRL)
    locale: 'de-DE',
  },
};

export const DEFAULT_CURRENCY = 'BRL';

/**
 * Converts a value from BRL to the target currency.
 * @param {number} valueInBrl - Numeric value in base currency (BRL)
 * @param {string} [targetCurrency='BRL'] - Currency code ('BRL' | 'USD' | 'EUR')
 * @returns {number}
 */
export const convertCurrency = (valueInBrl, targetCurrency = DEFAULT_CURRENCY) => {
  if (typeof valueInBrl !== 'number' || isNaN(valueInBrl)) {
    return 0;
  }

  const config =
    SUPPORTED_CURRENCIES[targetCurrency] || SUPPORTED_CURRENCIES[DEFAULT_CURRENCY];

  return valueInBrl * config.rate;
};

/**
 * Converts and formats a value from BRL into a localized currency string.
 * @param {number} valueInBrl - Numeric value in base currency (BRL)
 * @param {string} [targetCurrency='BRL'] - Currency code ('BRL' | 'USD' | 'EUR')
 * @returns {string}
 */
export const formatCurrencyWithCode = (
  valueInBrl,
  targetCurrency = DEFAULT_CURRENCY,
) => {
  if (typeof valueInBrl !== 'number' || isNaN(valueInBrl)) {
    return 'R$ 0,00';
  }

  const config =
    SUPPORTED_CURRENCIES[targetCurrency] || SUPPORTED_CURRENCIES[DEFAULT_CURRENCY];

  const convertedValue = valueInBrl * config.rate;

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
  }).format(convertedValue);
};

export default {
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
  convertCurrency,
  formatCurrencyWithCode,
};
