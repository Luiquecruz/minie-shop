import { describe, expect, it } from 'vitest';
import { PRODUCTS_MOCK } from '../../data/products';
import type { RootState } from '../index';
import cartReducer, {
  addToCart,
  applyCoupon,
  FREE_SHIPPING_THRESHOLD_BRL,
  initialCartState,
  setCouponInput,
  setOrderNote,
  setShippingMethod,
  updateQuantity,
} from '../slices/cartSlice';
import { DEFAULT_CURRENCY } from '../../utils/currency';
import {
  selectCartCount,
  selectCartDiscountAmount,
  selectCartFreeShippingRemaining,
  selectCartHasItems,
  selectCartItemById,
  selectCartItemIds,
  selectCartItemsByIdMap,
  selectCartQualifiesForFreeStandardShipping,
  selectCartShippingCost,
  selectCartStockWarningById,
  selectCartSubtotal,
  selectCartTotal,
} from './cartSelectors';

function buildRootState(
  cart = initialCartState,
  currentCurrency = DEFAULT_CURRENCY,
): RootState {
  return {
    cart,
    currency: { currentCurrency },
  };
}

describe('cartSelectors memoization & calculations', () => {
  const cheapProduct =
    PRODUCTS_MOCK.find((p) => p.price.final_price < 200) ?? PRODUCTS_MOCK[0];
  const secondProduct =
    PRODUCTS_MOCK.find((p) => p.id !== cheapProduct.id) ?? PRODUCTS_MOCK[1];

  it('calculates subtotal, discount, shipping rules, free-shipping threshold, and total', () => {
    let cart = cartReducer(
      initialCartState,
      addToCart({ product: cheapProduct, quantity: 1 }),
    );
    const rootLow = buildRootState(cart);

    const expectedSubtotal = cheapProduct.price.final_price;
    expect(selectCartHasItems(rootLow)).toBe(true);
    expect(selectCartCount(rootLow)).toBe(1);
    expect(selectCartSubtotal(rootLow)).toBeCloseTo(expectedSubtotal, 2);

    if (expectedSubtotal < FREE_SHIPPING_THRESHOLD_BRL) {
      expect(selectCartQualifiesForFreeStandardShipping(rootLow)).toBe(false);
      expect(selectCartShippingCost(rootLow)).toBe(19.9);
      expect(selectCartFreeShippingRemaining(rootLow)).toBeCloseTo(
        FREE_SHIPPING_THRESHOLD_BRL - expectedSubtotal,
        2,
      );
      expect(selectCartTotal(rootLow)).toBeCloseTo(
        expectedSubtotal + 19.9,
        2,
      );
    }

    cart = cartReducer(cart, applyCoupon('MINIE10'));
    const rootDiscounted = buildRootState(cart);
    expect(selectCartDiscountAmount(rootDiscounted)).toBeCloseTo(
      expectedSubtotal * 0.1,
      2,
    );

    cart = cartReducer(cart, setShippingMethod('express'));
    const rootExpress = buildRootState(cart);
    expect(selectCartShippingCost(rootExpress)).toBe(49.9);

    cart = cartReducer(cart, applyCoupon('FREESHIP'));
    const rootFreeship = buildRootState(cart);
    expect(selectCartShippingCost(rootFreeship)).toBe(0);
    expect(selectCartDiscountAmount(rootFreeship)).toBe(0);

    cart = cartReducer(cart, setShippingMethod('pickup'));
    expect(selectCartShippingCost(buildRootState(cart))).toBe(0);
    expect(selectCartShippingCost(buildRootState(initialCartState))).toBe(0);
  });

  it('memoizes derived selectors and avoids recomputations on unrelated state changes', () => {
    let cart = cartReducer(initialCartState, addToCart(cheapProduct));
    cart = cartReducer(cart, addToCart(secondProduct));

    const state1 = buildRootState(cart, 'BRL');

    selectCartItemIds.resetRecomputations();
    selectCartItemsByIdMap.resetRecomputations();
    selectCartCount.resetRecomputations();
    selectCartSubtotal.resetRecomputations();
    selectCartDiscountAmount.resetRecomputations();
    selectCartShippingCost.resetRecomputations();
    selectCartTotal.resetRecomputations();

    const ids1 = selectCartItemIds(state1);
    const map1 = selectCartItemsByIdMap(state1);
    const count1 = selectCartCount(state1);
    const total1 = selectCartTotal(state1);
    expect(ids1).toEqual([cheapProduct.id, secondProduct.id]);
    expect(count1).toBe(2);
    expect(selectCartItemById(state1, secondProduct.id)).toBe(
      cart.items[1],
    );
    expect(selectCartStockWarningById(state1, secondProduct.id)).toBeNull();
    expect(selectCartSubtotal.recomputations()).toBe(1);
    expect(selectCartTotal.recomputations()).toBe(1);

    // Mutating orderNote, couponInput, and currency must NOT recompute item/subtotal/shipping/total selectors
    const withNote = cartReducer(cart, setOrderNote('Deliver after 18h'));
    const withCouponInput = cartReducer(withNote, setCouponInput('MIN'));
    const state2 = buildRootState(withCouponInput, 'USD');

    expect(selectCartItemIds(state2)).toBe(ids1);
    expect(selectCartItemsByIdMap(state2)).toBe(map1);
    expect(selectCartCount(state2)).toBe(count1);
    expect(selectCartTotal(state2)).toBe(total1);
    expect(selectCartItemIds.recomputations()).toBe(1);
    expect(selectCartItemsByIdMap.recomputations()).toBe(1);
    expect(selectCartCount.recomputations()).toBe(1);
    expect(selectCartSubtotal.recomputations()).toBe(1);
    expect(selectCartDiscountAmount.recomputations()).toBe(1);
    expect(selectCartShippingCost.recomputations()).toBe(1);
    expect(selectCartTotal.recomputations()).toBe(1);

    // Updating item #1 preserves item #2's exact object reference
    const withQty = cartReducer(
      withCouponInput,
      updateQuantity({ id: cheapProduct.id, quantity: 2 }),
    );
    const state3 = buildRootState(withQty, 'USD');
    expect(selectCartItemById(state3, secondProduct.id)).toBe(
      selectCartItemById(state1, secondProduct.id),
    );
    expect(selectCartTotal(state3)).toBeGreaterThan(total1);
    expect(selectCartSubtotal.recomputations()).toBe(2);
    expect(selectCartTotal.recomputations()).toBe(2);
  });
});
