import type {
  ImageDTO,
  MoneyDTO,
  ProductCardDTO,
  ProductDetailDTO,
} from '@minieshop/contracts';

/**
 * Product payload accepted by `addToCart` (either catalog card or PDP detail).
 */
export type CartProductInput = ProductCardDTO | ProductDetailDTO;

/**
 * Shopping cart line item snapshot persisted in Redux and versioned localStorage (v2).
 * All prices are stored strictly as integer cents (`MoneyDTO`).
 */
export interface CartItem {
  id: string;
  slug: string;
  categorySlug: string;
  name: string;
  price: MoneyDTO;
  image: ImageDTO | null;
  inStock: boolean;
  stock: number;
  quantity: number;
}

/**
 * Map of product UUIDs to active stock warning messages.
 */
export type StockWarningsMap = Record<string, string>;

/**
 * Supported payload shapes for `addToCart` action.
 */
export type AddToCartPayload =
  | { product: CartProductInput; quantity?: number; stock?: number }
  | CartProductInput;

/**
 * Supported shipping method identifiers for CartPage.
 */
export type ShippingMethodId = 'standard' | 'express' | 'pickup';

/**
 * Shipping option metadata priced in integer BRL cents.
 */
export interface ShippingOption {
  id: ShippingMethodId;
  name: string;
  eta: string;
  basePriceCents: number;
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
