/**
 * Minie Shop Pricing Engine
 * Reusable logic for price precedence calculations, discounts, and currency formatting.
 */

import { formatCurrencyWithCode, DEFAULT_CURRENCY } from './currency.js';

/**
 * Formats a numeric value into a currency representation.
 * Supports multi-currency (BRL, USD, EUR).
 * @param {number} value - Base currency value (BRL)
 * @param {string} [currency='BRL'] - Desired currency code ('BRL' | 'USD' | 'EUR')
 * @returns {string}
 */
export const formatCurrency = (value, currency = DEFAULT_CURRENCY) => {
  return formatCurrencyWithCode(value, currency);
};

/**
 * Price calculation engine:
 * - Precedence: special_price is a discount. If it exists, is greater than zero and less than regular_price:
 *   - final_price is the lowest applicable price (special_price)
 *   - has_discount = true
 *   - discount_percentage = Math.round(((regular_price - final_price) / regular_price) * 100)
 * - Otherwise:
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
  // Backward compatibility if rawPrice is passed as a primitive number
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

  // Determine the lowest applicable price
  const finalPrice = hasDiscount ? specialPrice : regularPrice;

  // Calculate discount percentage relative to regular price
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
