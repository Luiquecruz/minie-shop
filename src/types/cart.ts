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
