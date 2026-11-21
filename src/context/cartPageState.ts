import { createContext, useContext } from 'react';
import type { CartItem, StockWarningsMap } from '../types';

export type ShippingMethodId = 'standard' | 'express' | 'pickup';

export interface ShippingOption {
  id: ShippingMethodId;
  name: string;
  eta: string;
  basePriceBrl: number;
}

export const FREE_SHIPPING_THRESHOLD_BRL = 500;

export const SHIPPING_OPTIONS: readonly ShippingOption[] = [
  {
    id: 'standard',
    name: 'Standard Delivery',
    eta: '5-7 business days',
    basePriceBrl: 19.9,
  },
  {
    id: 'express',
    name: 'Express Courier',
    eta: '1-2 business days',
    basePriceBrl: 49.9,
  },
  {
    id: 'pickup',
    name: 'Store Pickup',
    eta: 'Ready in 2 hours',
    basePriceBrl: 0,
  },
];

export interface AppliedCoupon {
  code: string;
  label: string;
  discountPercent?: number;
  freeShipping?: boolean;
}

export const PROMO_COUPONS: Record<string, AppliedCoupon> = {
  MINIE10: {
    code: 'MINIE10',
    label: '10% off items subtotal',
    discountPercent: 10,
  },
  MINIE20: {
    code: 'MINIE20',
    label: '20% off items subtotal',
    discountPercent: 20,
  },
  FREESHIP: {
    code: 'FREESHIP',
    label: 'Free Standard or Express shipping',
    freeShipping: true,
  },
};

export interface CartPageState {
  items: CartItem[];
  couponInput: string;
  appliedCoupon: AppliedCoupon | null;
  couponError: string | null;
  shippingMethod: ShippingMethodId;
  orderNote: string;
  stockWarnings: StockWarningsMap;
}

export type CartPageAction =
  | { type: 'SYNC_ITEMS'; payload: CartItem[] }
  | { type: 'UPDATE_QUANTITY'; payload: { id: number; quantity: number } }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_STOCK_WARNING'; payload: { id: number; message: string | null } }
  | { type: 'SET_COUPON_INPUT'; payload: string }
  | { type: 'APPLY_COUPON'; payload?: string }
  | { type: 'REMOVE_COUPON' }
  | { type: 'SET_SHIPPING_METHOD'; payload: ShippingMethodId }
  | { type: 'SET_ORDER_NOTE'; payload: string };

export const createInitialCartPageState = (
  initialItems: CartItem[],
): CartPageState => ({
  items: initialItems,
  couponInput: '',
  appliedCoupon: null,
  couponError: null,
  shippingMethod: 'standard',
  orderNote: '',
  stockWarnings: {},
});

export function areCartItemsEqual(a: CartItem[], b: CartItem[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].id !== b[i].id ||
      a[i].quantity !== b[i].quantity ||
      a[i].stock !== b[i].stock
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Monolithic CartPage reducer handling items, promo coupons, shipping, notes, and monitor state.
 */
export function cartPageReducer(
  state: CartPageState,
  action: CartPageAction,
): CartPageState {
  switch (action.type) {
    case 'SYNC_ITEMS': {
      const activeIds = new Set(action.payload.map((item) => item.id));
      const nextWarnings: StockWarningsMap = {};
      Object.entries(state.stockWarnings).forEach(([key, value]) => {
        const numericId = Number(key);
        if (activeIds.has(numericId)) {
          nextWarnings[numericId] = value;
        }
      });
      return {
        ...state,
        items: action.payload,
        stockWarnings: nextWarnings,
      };
    }

    case 'UPDATE_QUANTITY': {
      const { id, quantity } = action.payload;
      const target = state.items.find((item) => item.id === id);
      if (!target) return state;

      const maxStock = typeof target.stock === 'number' ? target.stock : 99;
      const nextWarnings: StockWarningsMap = { ...state.stockWarnings };
      let clampedQty = quantity;

      if (quantity < 1) {
        clampedQty = 1;
        delete nextWarnings[id];
      } else if (quantity > maxStock) {
        clampedQty = maxStock;
        nextWarnings[id] = `Only ${maxStock} units in stock.`;
      } else {
        delete nextWarnings[id];
      }

      const nextItems = state.items.map((item) =>
        item.id === id ? { ...item, quantity: clampedQty } : item,
      );

      return {
        ...state,
        items: nextItems,
        stockWarnings: nextWarnings,
      };
    }

    case 'REMOVE_ITEM': {
      const id = action.payload;
      const nextWarnings: StockWarningsMap = { ...state.stockWarnings };
      delete nextWarnings[id];
      return {
        ...state,
        items: state.items.filter((item) => item.id !== id),
        stockWarnings: nextWarnings,
      };
    }

    case 'CLEAR_CART':
      return {
        ...state,
        items: [],
        stockWarnings: {},
        appliedCoupon: null,
        couponError: null,
        couponInput: '',
        orderNote: '',
      };

    case 'SET_STOCK_WARNING': {
      const { id, message } = action.payload;
      const nextWarnings: StockWarningsMap = { ...state.stockWarnings };
      if (message) {
        nextWarnings[id] = message;
      } else {
        delete nextWarnings[id];
      }
      return {
        ...state,
        stockWarnings: nextWarnings,
      };
    }

    case 'SET_COUPON_INPUT':
      return {
        ...state,
        couponInput: action.payload,
        couponError: null,
      };

    case 'APPLY_COUPON': {
      const rawCode = (action.payload ?? state.couponInput).trim().toUpperCase();
      if (!rawCode) {
        return {
          ...state,
          couponError: 'Enter a promo code to apply.',
        };
      }

      const matched = PROMO_COUPONS[rawCode];
      if (!matched) {
        return {
          ...state,
          couponError: `Promo code "${rawCode}" is invalid. Try MINIE10, MINIE20, or FREESHIP.`,
        };
      }

      return {
        ...state,
        couponInput: rawCode,
        appliedCoupon: matched,
        couponError: null,
      };
    }

    case 'REMOVE_COUPON':
      return {
        ...state,
        appliedCoupon: null,
        couponError: null,
        couponInput: '',
      };

    case 'SET_SHIPPING_METHOD':
      return {
        ...state,
        shippingMethod: action.payload,
      };

    case 'SET_ORDER_NOTE':
      return {
        ...state,
        orderNote: action.payload.slice(0, 200),
      };

    default:
      return state;
  }
}

export interface CartPageContextValue {
  state: CartPageState;
  totalUnits: number;
  subtotal: number;
  discountAmount: number;
  shippingCost: number;
  freeShippingRemaining: number;
  total: number;
  updateQuantity: (id: number, quantity: number) => void;
  removeItem: (id: number) => void;
  clearCart: () => void;
  setStockWarning: (id: number, message: string | null) => void;
  setCouponInput: (value: string) => void;
  applyCoupon: (codeOverride?: string) => void;
  removeCoupon: () => void;
  setShippingMethod: (method: ShippingMethodId) => void;
  setOrderNote: (note: string) => void;
}

export const CartPageContext = createContext<CartPageContextValue | null>(null);

/**
 * Consumes the monolithic CartPageContext. Throws when used outside CartPageProvider.
 */
export function useCartPageContext(): CartPageContextValue {
  const ctx = useContext(CartPageContext);
  if (!ctx) {
    throw new Error('useCartPageContext must be used inside CartPageProvider.');
  }
  return ctx;
}
