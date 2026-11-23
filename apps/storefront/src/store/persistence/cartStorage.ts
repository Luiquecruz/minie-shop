import type {
  AppliedCoupon,
  CalculatedPrice,
  CartItem,
  ShippingMethodId,
} from '../../types';
import { PROMO_COUPONS } from '../slices/cartConstants';

export const CART_ITEMS_STORAGE_KEY = 'minieshop_cart';
export const CART_PREFS_STORAGE_KEY = 'minieshop_cart_prefs';

export interface PersistedCartPrefs {
  appliedCoupon: AppliedCoupon | null;
  shippingMethod: ShippingMethodId;
  orderNote: string;
}

const DEFAULT_PREFS: PersistedCartPrefs = {
  appliedCoupon: null,
  shippingMethod: 'standard',
  orderNote: '',
};

const isNonNegativeFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isCalculatedPrice = (value: unknown): value is CalculatedPrice => {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'regular_price' in value &&
    isNonNegativeFinite(value.regular_price) &&
    'special_price' in value &&
    (value.special_price === null || isNonNegativeFinite(value.special_price)) &&
    'final_price' in value &&
    isNonNegativeFinite(value.final_price) &&
    'discount_percentage' in value &&
    isNonNegativeFinite(value.discount_percentage) &&
    'has_discount' in value &&
    typeof value.has_discount === 'boolean'
  );
};

export const isValidCartItem = (item: unknown): item is CartItem => {
  if (typeof item !== 'object' || item === null) return false;
  if (
    !('id' in item) ||
    typeof item.id !== 'number' ||
    !Number.isInteger(item.id) ||
    item.id <= 0
  ) {
    return false;
  }
  if (!('name' in item) || typeof item.name !== 'string') return false;
  if (!('price' in item) || !isCalculatedPrice(item.price)) return false;
  if (!('image' in item) || typeof item.image !== 'string') return false;
  if (!('category' in item) || typeof item.category !== 'string') return false;
  if (
    !('stock' in item) ||
    typeof item.stock !== 'number' ||
    !Number.isInteger(item.stock) ||
    item.stock < 1
  ) {
    return false;
  }
  if (
    !('quantity' in item) ||
    typeof item.quantity !== 'number' ||
    !Number.isInteger(item.quantity) ||
    item.quantity < 1 ||
    item.quantity > item.stock
  ) {
    return false;
  }
  return true;
};

export const isShippingMethodId = (value: unknown): value is ShippingMethodId =>
  value === 'standard' || value === 'express' || value === 'pickup';

const resolvePersistedCoupon = (value: unknown): AppliedCoupon | null => {
  if (typeof value !== 'object' || value === null) return null;
  if (!('code' in value) || typeof value.code !== 'string') return null;
  if (!('label' in value) || typeof value.label !== 'string') return null;

  const normalizedCode = value.code.trim().toUpperCase();
  if (!Object.hasOwn(PROMO_COUPONS, normalizedCode)) {
    return null;
  }

  if (
    'discountPercent' in value &&
    value.discountPercent !== undefined &&
    (typeof value.discountPercent !== 'number' ||
      !Number.isFinite(value.discountPercent) ||
      value.discountPercent <= 0 ||
      value.discountPercent > 100)
  ) {
    return null;
  }

  if (
    'freeShipping' in value &&
    value.freeShipping !== undefined &&
    typeof value.freeShipping !== 'boolean'
  ) {
    return null;
  }

  return PROMO_COUPONS[normalizedCode];
};

/**
 * Safely reads persisted cart line items from localStorage.
 */
export const loadPersistedCartItems = (): CartItem[] => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(CART_ITEMS_STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter(isValidCartItem);
        }
      }
    }
  } catch (error: unknown) {
    console.warn('Failed to read cart items from localStorage:', error);
  }
  return [];
};

/**
 * Safely persists cart line items to localStorage.
 */
export const savePersistedCartItems = (items: CartItem[]): void => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CART_ITEMS_STORAGE_KEY, JSON.stringify(items));
    }
  } catch (error: unknown) {
    console.warn('Failed to persist cart items to localStorage:', error);
  }
};

/**
 * Safely reads persisted cart checkout preferences (coupon, shipping, note) from localStorage.
 */
export const loadPersistedCartPrefs = (): PersistedCartPrefs => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(CART_PREFS_STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          const appliedCoupon =
            'appliedCoupon' in parsed
              ? resolvePersistedCoupon(parsed.appliedCoupon)
              : null;
          const shippingMethod =
            'shippingMethod' in parsed &&
            isShippingMethodId(parsed.shippingMethod)
              ? parsed.shippingMethod
              : 'standard';
          const orderNote =
            'orderNote' in parsed && typeof parsed.orderNote === 'string'
              ? parsed.orderNote.slice(0, 200)
              : '';
          return { appliedCoupon, shippingMethod, orderNote };
        }
      }
    }
  } catch (error: unknown) {
    console.warn('Failed to read cart preferences from localStorage:', error);
  }
  return DEFAULT_PREFS;
};

/**
 * Safely persists cart checkout preferences to localStorage.
 */
export const savePersistedCartPrefs = (prefs: PersistedCartPrefs): void => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CART_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    }
  } catch (error: unknown) {
    console.warn('Failed to persist cart preferences to localStorage:', error);
  }
};
