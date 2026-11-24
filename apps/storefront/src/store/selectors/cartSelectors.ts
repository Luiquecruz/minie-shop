import { createSelector } from '@reduxjs/toolkit';
import type {
  AppliedCoupon,
  CartItem,
  ShippingMethodId,
  ShippingOption,
  StockWarningsMap,
} from '../../types';
import type { RootState } from '../index';
import {
  defaultCartShippingPricing,
  type CartShippingPricing,
  type CartState,
} from '../slices/cartSlice';

export const selectCartState = (state: RootState): CartState => state.cart;
export const selectCartItems = (state: RootState): CartItem[] => state.cart.items;
export const selectIsCartOpen = (state: RootState): boolean => state.cart.isOpen;
export const selectCartStockWarnings = (state: RootState): StockWarningsMap =>
  state.cart.stockWarnings;
export const selectCartCouponInput = (state: RootState): string =>
  state.cart.couponInput;
export const selectCartAppliedCoupon = (state: RootState): AppliedCoupon | null =>
  state.cart.appliedCoupon;
export const selectCartCouponError = (state: RootState): string | null =>
  state.cart.couponError;
export const selectCartShippingMethod = (state: RootState): ShippingMethodId =>
  state.cart.shippingMethod;
export const selectCartShippingPricing = (state: RootState): CartShippingPricing =>
  state.cart.shippingPricing ?? defaultCartShippingPricing;
export const selectCartShippingOptions = (
  state: RootState,
): readonly ShippingOption[] => selectCartShippingPricing(state).options;
export const selectCartFreeShippingThresholdCents = (state: RootState): number =>
  selectCartShippingPricing(state).freeShippingThresholdCents;
export const selectLastQuoteUpdatedAt = (state: RootState): number =>
  state.cart.lastQuoteUpdatedAt ?? 0;
export const selectCartOrderNote = (state: RootState): string =>
  state.cart.orderNote;

export const selectCartItemIds = createSelector(
  [selectCartItems],
  (items): string[] => items.map((item) => item.id),
);

export const MAX_CROSS_SELL_CART_PRODUCT_IDS = 20;

/**
 * Returns up to 20 most recently added distinct product IDs in the cart
 * (for R05.3 cross-sell recommendations).
 */
export const selectRecentCartProductIds = createSelector(
  [selectCartItems],
  (items): string[] => {
    const seen = new Set<string>();
    const recent: string[] = [];
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const id = items[i].id;
      if (!seen.has(id)) {
        seen.add(id);
        recent.push(id);
        if (recent.length >= MAX_CROSS_SELL_CART_PRODUCT_IDS) {
          break;
        }
      }
    }
    return recent;
  },
);

export const selectCartItemsByIdMap = createSelector(
  [selectCartItems],
  (items): Record<string, CartItem> =>
    items.reduce<Record<string, CartItem>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {}),
);

export const selectCartItemById = (
  state: RootState,
  id: string,
): CartItem | undefined => selectCartItemsByIdMap(state)[id];

export const selectCartStockWarningById = (
  state: RootState,
  id: string,
): string | null => selectCartStockWarnings(state)[id] ?? null;

export const selectCartHasItems = createSelector(
  [selectCartItems],
  (items): boolean => items.length > 0,
);

export const selectCartCount = createSelector(
  [selectCartItems],
  (items): number => items.reduce((total, item) => total + item.quantity, 0),
);

/**
 * Cart subtotal strictly in integer cents.
 */
export const selectCartSubtotal = createSelector(
  [selectCartItems],
  (items): number =>
    items.reduce((total, item) => total + item.price.amount * item.quantity, 0),
);

/**
 * Promo discount amount rounded to integer cents.
 */
export const selectCartDiscountAmount = createSelector(
  [selectCartSubtotal, selectCartAppliedCoupon],
  (subtotal, appliedCoupon): number =>
    appliedCoupon?.discountPercent
      ? Math.round((subtotal * appliedCoupon.discountPercent) / 100)
      : 0,
);

export const selectCartQualifiesForFreeStandardShipping = createSelector(
  [selectCartSubtotal, selectCartFreeShippingThresholdCents],
  (subtotal, threshold): boolean => subtotal >= threshold,
);

export const selectCartHasFreeShippingCoupon = createSelector(
  [selectCartAppliedCoupon],
  (appliedCoupon): boolean => Boolean(appliedCoupon?.freeShipping),
);

/**
 * Shipping cost strictly in integer cents.
 */
export const selectCartShippingCost = createSelector(
  [
    selectCartHasItems,
    selectCartQualifiesForFreeStandardShipping,
    selectCartHasFreeShippingCoupon,
    selectCartShippingMethod,
    selectCartShippingOptions,
  ],
  (
    hasItems,
    qualifiesForFreeStandard,
    hasFreeShippingCoupon,
    shippingMethod,
    shippingOptions,
  ): number => {
    if (!hasItems) return 0;
    if (shippingMethod === 'pickup') return 0;
    if (hasFreeShippingCoupon) return 0;
    if (shippingMethod === 'standard' && qualifiesForFreeStandard) return 0;
    const option = shippingOptions.find((opt) => opt.id === shippingMethod);
    return option ? option.basePriceCents : shippingOptions[0].basePriceCents;
  },
);

export const selectCartFreeShippingRemaining = createSelector(
  [selectCartSubtotal, selectCartFreeShippingThresholdCents],
  (subtotal, threshold): number => Math.max(0, threshold - subtotal),
);

/**
 * Estimated cart total strictly in integer cents.
 */
export const selectCartTotal = createSelector(
  [selectCartSubtotal, selectCartDiscountAmount, selectCartShippingCost],
  (subtotal, discountAmount, shippingCost): number =>
    Math.max(0, subtotal - discountAmount) + shippingCost,
);
