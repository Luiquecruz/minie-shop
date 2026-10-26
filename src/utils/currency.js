/**
 * Motor de Currency (Multi-Moedas) da Minie Shop
 * Suporta BRL (base), USD e EUR com conversão e formatação localizada.
 */

export const SUPPORTED_CURRENCIES = {
  BRL: {
    code: 'BRL',
    label: 'BRL (R$)',
    symbol: 'R$',
    rate: 1.0, // Moeda base do catálogo
    locale: 'pt-BR',
  },
  USD: {
    code: 'USD',
    label: 'USD ($)',
    symbol: '$',
    rate: 0.18, // 1 BRL = 0.18 USD (ex: 1 USD ~ 5.55 BRL)
    locale: 'en-US',
  },
  EUR: {
    code: 'EUR',
    label: 'EUR (€)',
    symbol: '€',
    rate: 0.16, // 1 BRL = 0.16 EUR (ex: 1 EUR ~ 6.25 BRL)
    locale: 'de-DE',
  },
};

export const DEFAULT_CURRENCY = 'BRL';

/**
 * Converte um valor em BRL para a moeda de destino.
 * @param {number} valueInBrl - Valor na moeda base (BRL)
 * @param {string} [targetCurrency='BRL'] - Código da moeda ('BRL' | 'USD' | 'EUR')
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
 * Converte e formata um valor em BRL para a representação monetária na moeda alvo.
 * @param {number} valueInBrl - Valor na moeda base (BRL)
 * @param {string} [targetCurrency='BRL'] - Código da moeda ('BRL' | 'USD' | 'EUR')
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
