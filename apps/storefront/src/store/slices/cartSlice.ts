import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ImageDTO } from '@minieshop/contracts';
import type {
  AddToCartPayload,
  AppliedCoupon,
  CartItem,
  CartProductInput,
  ShippingMethodId,
  StockWarningsMap,
} from '../../types';
import {
  DEFAULT_FALLBACK_STOCK,
  FREE_SHIPPING_THRESHOLD_CENTS,
  MAX_ORDER_NOTE_LENGTH,
  PROMO_COUPONS,
  SHIPPING_OPTIONS,
} from './cartConstants';

export {
  FREE_SHIPPING_THRESHOLD_CENTS,
  MAX_ORDER_NOTE_LENGTH,
  PROMO_COUPONS,
  SHIPPING_OPTIONS,
};

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
  stockWarnings: StockWarningsMap;
  couponInput: string;
  appliedCoupon: AppliedCoupon | null;
  couponError: string | null;
  shippingMethod: ShippingMethodId;
  orderNote: string;
}

export const initialCartState: CartState = {
  items: [],
  isOpen: false,
  stockWarnings: {},
  couponInput: '',
  appliedCoupon: null,
  couponError: null,
  shippingMethod: 'standard',
  orderNote: '',
};

/**
 * Resolves valid upper stock bound, retaining fallback 99 when stock is
 * unknown/non-numeric and product is in stock. Zero or negative means unavailable.
 */
export const resolveMaxStock = (stock: unknown, inStock: boolean = true): number => {
  if (!inStock) return 0;
  if (typeof stock === 'number' && Number.isFinite(stock)) {
    return Math.max(0, Math.floor(stock));
  }
  return DEFAULT_FALLBACK_STOCK;
};

const sanitizeQuantity = (raw: unknown): number | null => {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return Math.floor(raw);
};

const resolvePrimaryImage = (product: CartProductInput): ImageDTO | null => {
  if ('image' in product) {
    return product.image;
  }
  return product.images[0] ?? null;
};

const resolveCategorySlug = (product: CartProductInput): string => {
  if ('categorySlug' in product) {
    return product.categorySlug;
  }
  return product.category.slug;
};

const setWarningImmutable = (
  warnings: StockWarningsMap,
  id: string,
  message: string | null,
): StockWarningsMap => {
  if (message) {
    if (warnings[id] === message) return warnings;
    return { ...warnings, [id]: message };
  }
  if (!(id in warnings)) return warnings;
  const nextWarnings: StockWarningsMap = {};
  Object.entries(warnings).forEach(([key, value]) => {
    if (key !== id) {
      nextWarnings[key] = value;
    }
  });
  return nextWarnings;
};

/**
 * Pure immutable cart slice: reducers perform zero side effects and return new
 * state snapshots preserving structural sharing for unchanged line items.
 */
export const cartSlice = createSlice({
  name: 'cart',
  initialState: initialCartState,
  reducers: {
    addToCart: (state, action: PayloadAction<AddToCartPayload>): CartState => {
      const payload = action.payload;
      const product = 'product' in payload ? payload.product : payload;
      const rawAddQty = 'product' in payload ? payload.quantity : 1;
      const explicitStock = 'product' in payload ? payload.stock : undefined;
      const parsedQty = sanitizeQuantity(rawAddQty);
      const safeAddQty = parsedQty === null ? 1 : Math.max(1, parsedQty);

      if (!product || !product.id) return state;

      const existingIndex = state.items.findIndex((item) => item.id === product.id);

      if (existingIndex >= 0) {
        const existing = state.items[existingIndex];
        const maxStock =
          explicitStock !== undefined
            ? resolveMaxStock(explicitStock, product.inStock)
            : product.inStock
              ? existing.stock
              : 0;
        if (maxStock <= 0) {
          return state;
        }
        const targetQty = existing.quantity + safeAddQty;
        const clampedQty = targetQty > maxStock ? maxStock : targetQty;
        const warningMsg =
          targetQty > maxStock ? `Max stock reached (${maxStock} units).` : null;

        const nextItems =
          clampedQty === existing.quantity && maxStock === existing.stock
            ? state.items
            : state.items.map((item, idx) =>
                idx === existingIndex
                  ? { ...item, quantity: clampedQty, stock: maxStock }
                  : item,
              );

        return {
          ...state,
          items: nextItems,
          stockWarnings: setWarningImmutable(
            state.stockWarnings,
            product.id,
            warningMsg,
          ),
          isOpen: true,
        };
      }

      const maxStock = resolveMaxStock(explicitStock, product.inStock);
      if (maxStock <= 0) {
        return state;
      }

      const initialQty = Math.min(safeAddQty, maxStock);
      const newItem: CartItem = {
        id: product.id,
        slug: product.slug,
        categorySlug: resolveCategorySlug(product),
        name: product.name,
        price: product.price,
        image: resolvePrimaryImage(product),
        inStock: product.inStock,
        stock: maxStock,
        quantity: initialQty,
      };
      const warningMsg =
        safeAddQty > maxStock ? `Only ${maxStock} units available.` : null;

      return {
        ...state,
        items: [...state.items, newItem],
        stockWarnings: setWarningImmutable(
          state.stockWarnings,
          product.id,
          warningMsg,
        ),
        isOpen: true,
      };
    },

    updateQuantity: (
      state,
      action: PayloadAction<{ id: string; quantity: number }>,
    ): CartState => {
      const { id, quantity } = action.payload;
      const parsedQty = sanitizeQuantity(quantity);
      if (parsedQty === null) return state;

      const targetIndex = state.items.findIndex((item) => item.id === id);
      if (targetIndex < 0) return state;

      const target = state.items[targetIndex];
      const maxStock = Math.max(1, resolveMaxStock(target.stock, true));
      const clampedQty = Math.min(Math.max(parsedQty, 1), maxStock);
      const warningMsg =
        parsedQty > maxStock ? `Only ${maxStock} units in stock.` : null;

      const nextWarnings = setWarningImmutable(state.stockWarnings, id, warningMsg);
      if (target.quantity === clampedQty && nextWarnings === state.stockWarnings) {
        return state;
      }

      const nextItems =
        target.quantity === clampedQty
          ? state.items
          : state.items.map((item, idx) =>
              idx === targetIndex ? { ...item, quantity: clampedQty } : item,
            );

      return {
        ...state,
        items: nextItems,
        stockWarnings: nextWarnings,
      };
    },

    setStockWarning: (
      state,
      action: PayloadAction<{ id: string; message: string | null }>,
    ): CartState => {
      const { id, message } = action.payload;
      const nextWarnings = setWarningImmutable(state.stockWarnings, id, message);
      if (nextWarnings === state.stockWarnings) return state;
      return {
        ...state,
        stockWarnings: nextWarnings,
      };
    },

    removeFromCart: (state, action: PayloadAction<string>): CartState => {
      const id = action.payload;
      if (!state.items.some((item) => item.id === id)) return state;
      return {
        ...state,
        items: state.items.filter((item) => item.id !== id),
        stockWarnings: setWarningImmutable(state.stockWarnings, id, null),
      };
    },

    clearCart: (state): CartState => ({
      ...state,
      items: [],
      stockWarnings: {},
      appliedCoupon: null,
      couponError: null,
      couponInput: '',
      orderNote: '',
    }),

    setCouponInput: (state, action: PayloadAction<string>): CartState => {
      if (state.couponInput === action.payload && state.couponError === null) {
        return state;
      }
      return {
        ...state,
        couponInput: action.payload,
        couponError: null,
      };
    },

    applyCoupon: (state, action: PayloadAction<string | undefined>): CartState => {
      const rawCode = (action.payload ?? state.couponInput).trim().toUpperCase();
      if (!rawCode) {
        return {
          ...state,
          couponError: 'Enter a promo code to apply.',
        };
      }

      const matched = Object.hasOwn(PROMO_COUPONS, rawCode)
        ? PROMO_COUPONS[rawCode]
        : undefined;
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
    },

    removeCoupon: (state): CartState => {
      if (!state.appliedCoupon && !state.couponError && state.couponInput === '') {
        return state;
      }
      return {
        ...state,
        appliedCoupon: null,
        couponError: null,
        couponInput: '',
      };
    },

    setShippingMethod: (
      state,
      action: PayloadAction<ShippingMethodId>,
    ): CartState => {
      if (state.shippingMethod === action.payload) return state;
      return {
        ...state,
        shippingMethod: action.payload,
      };
    },

    setOrderNote: (state, action: PayloadAction<string>): CartState => {
      const clampedNote = action.payload.slice(0, MAX_ORDER_NOTE_LENGTH);
      if (state.orderNote === clampedNote) return state;
      return {
        ...state,
        orderNote: clampedNote,
      };
    },

    openCart: (state): CartState =>
      state.isOpen ? state : { ...state, isOpen: true },

    closeCart: (state): CartState =>
      state.isOpen ? { ...state, isOpen: false } : state,

    toggleCart: (state): CartState => ({
      ...state,
      isOpen: !state.isOpen,
    }),
  },
});

export const {
  addToCart,
  updateQuantity,
  setStockWarning,
  removeFromCart,
  clearCart,
  setCouponInput,
  applyCoupon,
  removeCoupon,
  setShippingMethod,
  setOrderNote,
  openCart,
  closeCart,
  toggleCart,
} = cartSlice.actions;

export default cartSlice.reducer;
