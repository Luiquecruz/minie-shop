import {
  clientImageDtoSchema,
  clientMoneySchema,
} from '@minieshop/contracts/catalog/client';
import type {
  AppliedCoupon,
  CartItem,
  ShippingMethodId,
} from '../../types';
import { PROMO_COUPONS } from '../slices/cartConstants';

export const CART_ITEMS_STORAGE_KEY = 'minieshop_cart';
export const CART_PREFS_STORAGE_KEY = 'minieshop_cart_prefs';
export const CART_STORAGE_VERSION = 2;

export interface PersistedCartEnvelopeV2 {
  version: typeof CART_STORAGE_VERSION;
  items: CartItem[];
}

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

export const isValidCartItem = (item: unknown): item is CartItem => {
  if (typeof item !== 'object' || item === null) return false;
  const candidate = item as Record<string, unknown>;

  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
    return false;
  }
  if (typeof candidate.slug !== 'string' || candidate.slug.trim().length === 0) {
    return false;
  }
  if (
    typeof candidate.categorySlug !== 'string' ||
    candidate.categorySlug.trim().length === 0
  ) {
    return false;
  }
  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
    return false;
  }
  if (!clientMoneySchema.safeParse(candidate.price).success) {
    return false;
  }
  if (
    candidate.image !== null &&
    !clientImageDtoSchema.safeParse(candidate.image).success
  ) {
    return false;
  }
  if (typeof candidate.inStock !== 'boolean') {
    return false;
  }
  if (
    typeof candidate.stock !== 'number' ||
    !Number.isInteger(candidate.stock) ||
    candidate.stock < 1
  ) {
    return false;
  }
  if (
    typeof candidate.quantity !== 'number' ||
    !Number.isInteger(candidate.quantity) ||
    candidate.quantity < 1 ||
    candidate.quantity > candidate.stock
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
 * Safely reads versioned (v2) persisted cart line items from localStorage.
 * Legacy v1 snapshots (unversioned arrays with numeric IDs and float prices)
 * are discarded safely and cleared so the cart starts cleanly on the API schema.
 */
export const loadPersistedCartItems = (): CartItem[] => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(CART_ITEMS_STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          !Array.isArray(parsed) &&
          'version' in parsed &&
          parsed.version === CART_STORAGE_VERSION &&
          'items' in parsed &&
          Array.isArray(parsed.items)
        ) {
          return parsed.items.filter(isValidCartItem);
        }

        // Legacy v1 or incompatible schema version: discard safely
        window.localStorage.removeItem(CART_ITEMS_STORAGE_KEY);
      }
    }
  } catch (error: unknown) {
    console.warn('Failed to read cart items from localStorage:', error);
  }
  return [];
};

/**
 * Safely persists versioned (v2) cart line items to localStorage.
 */
export const savePersistedCartItems = (items: CartItem[]): void => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const envelope: PersistedCartEnvelopeV2 = {
        version: CART_STORAGE_VERSION,
        items,
      };
      window.localStorage.setItem(CART_ITEMS_STORAGE_KEY, JSON.stringify(envelope));
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
