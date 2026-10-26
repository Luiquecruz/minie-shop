/**
 * Motor de Preço da Minie Shop
 * Lógica reutilizável para cálculo de precedência de preços, descontos e formatação monetária.
 */

import { formatCurrencyWithCode, DEFAULT_CURRENCY } from './currency.js';

/**
 * Formata um valor numérico para representação monetária.
 * Suporta multi-moedas (BRL, USD, EUR).
 * @param {number} value - Valor na moeda base (BRL)
 * @param {string} [currency='BRL'] - Moeda desejada ('BRL' | 'USD' | 'EUR')
 * @returns {string}
 */
export const formatCurrency = (value, currency = DEFAULT_CURRENCY) => {
  return formatCurrencyWithCode(value, currency);
};

/**
 * Motor de cálculo de preço:
 * - Precedência: special_price é desconto. Se existir, for maior que zero e menor que regular_price:
 *   - final_price é o menor preço aplicável (special_price)
 *   - has_discount = true
 *   - discount_percentage = Math.round(((regular_price - final_price) / regular_price) * 100)
 * - Caso contrário:
 *   - final_price = regular_price
 *   - has_discount = false
 *   - discount_percentage = 0
 *
 * @param {Object|number} rawPrice
 * @param {number} [rawPrice.regular_price]
 * @param {number|null} [rawPrice.special_price]
 * @param {number} [rawPrice.final_price]
 * @returns {{
 *   regular_price: number,
 *   special_price: number | null,
 *   final_price: number,
 *   discount_percentage: number,
 *   has_discount: boolean
 * }}
 */
export const calculatePrice = (rawPrice = {}) => {
  // Retrocompatibilidade se receber apenas um número
  if (typeof rawPrice === 'number') {
    return {
      regular_price: rawPrice,
      special_price: null,
      final_price: rawPrice,
      discount_percentage: 0,
      has_discount: false,
    };
  }

  const regularPrice = Number(rawPrice.regular_price) || 0;
  const specialPrice =
    rawPrice.special_price !== null &&
    rawPrice.special_price !== undefined &&
    rawPrice.special_price !== ''
      ? Number(rawPrice.special_price)
      : null;

  const hasDiscount =
    typeof specialPrice === 'number' &&
    !isNaN(specialPrice) &&
    specialPrice > 0 &&
    specialPrice < regularPrice;

  // Encontra o menor valor aplicável
  const finalPrice = hasDiscount ? specialPrice : regularPrice;

  // Calcula porcentagem com base na diferença do preço final vs regular
  const discountPercentage =
    hasDiscount && regularPrice > 0
      ? Math.round(((regularPrice - finalPrice) / regularPrice) * 100)
      : 0;

  return {
    regular_price: regularPrice,
    special_price: specialPrice,
    final_price: finalPrice,
    discount_percentage: discountPercentage,
    has_discount: hasDiscount,
  };
};

export default {
  calculatePrice,
  formatCurrency,
};
