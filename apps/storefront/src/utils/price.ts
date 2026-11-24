import type { CurrencyCode } from '../types';
import type { CalculatedPrice, RawPriceInput } from '../types/product';
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from './currency';

/**
 * Minie Shop Pricing Engine
 * Reusable logic for price precedence calculations, discounts, and currency formatting.
 */

/**
 * Formats an already-converted numeric value into a localized currency representation
 * (zero client-side FX conversion).
 */
export const formatCurrency = (
  value: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): string => {
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const config =
    SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES[DEFAULT_CURRENCY];
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
  }).format(safeValue);
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
 */
export const calculatePrice = (
  rawPrice: RawPriceInput | number = {},
): CalculatedPrice => {
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
    !Number.isNaN(specialPrice) &&
    specialPrice > 0 &&
    specialPrice < regularPrice;

  // Determine the lowest applicable price
  const finalPrice = hasDiscount && specialPrice !== null ? specialPrice : regularPrice;

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
