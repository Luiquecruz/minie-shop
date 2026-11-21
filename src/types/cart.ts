import type { CalculatedPrice, Product } from './product';

/**
 * Shopping cart line item persisted in Redux and localStorage.
 */
export interface CartItem {
  id: number;
  name: string;
  price: CalculatedPrice;
  image: string;
  category: string;
  stock: number;
  quantity: number;
}

/**
 * Map of product IDs to active stock warning messages.
 */
export type StockWarningsMap = Record<number, string>;

/**
 * Supported payload shapes for `addToCart` action.
 */
export type AddToCartPayload = { product: Product; quantity?: number } | Product;

/**
 * Supported shipping method identifiers for CartPage.
 */
export type ShippingMethodId = 'standard' | 'express' | 'pickup';

/**
 * Shipping option metadata priced in base BRL currency.
 */
export interface ShippingOption {
  id: ShippingMethodId;
  name: string;
  eta: string;
  basePriceBrl: number;
}

/**
 * Applied promo coupon definition.
 */
export interface AppliedCoupon {
  code: string;
  label: string;
  discountPercent?: number;
  freeShipping?: boolean;
}
