import { describe, expect, it } from 'vitest';
import { FIXTURE_PRODUCTS_DETAIL } from '../../test/fixtures/catalogFixture';
import type { RootState } from '../index';
import cartReducer, {
  addToCart,
  applyCoupon,
  FREE_SHIPPING_THRESHOLD_CENTS,
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

describe('cartSelectors memoization & integer-cents calculations', () => {
  const cheapProduct =
    FIXTURE_PRODUCTS_DETAIL.find(
      (p) => p.inStock && p.price.amount < 20_000,
    ) ?? FIXTURE_PRODUCTS_DETAIL[1];
  const secondProduct =
    FIXTURE_PRODUCTS_DETAIL.find(
      (p) => p.inStock && p.id !== cheapProduct.id && p.price.amount >= 40_000,
    ) ?? FIXTURE_PRODUCTS_DETAIL[2];

  it('calculates subtotal, discount, shipping rules, free-shipping threshold, and total in integer cents', () => {
    let cart = cartReducer(
      initialCartState,
      addToCart({ product: cheapProduct, quantity: 1 }),
    );
    const rootLow = buildRootState(cart);

    const expectedSubtotal = cheapProduct.price.amount;
    expect(selectCartHasItems(rootLow)).toBe(true);
    expect(selectCartCount(rootLow)).toBe(1);
    expect(selectCartSubtotal(rootLow)).toBe(expectedSubtotal);
    expect(Number.isInteger(selectCartSubtotal(rootLow))).toBe(true);

    expect(selectCartQualifiesForFreeStandardShipping(rootLow)).toBe(false);
    expect(selectCartShippingCost(rootLow)).toBe(1_990);
    expect(selectCartFreeShippingRemaining(rootLow)).toBe(
      FREE_SHIPPING_THRESHOLD_CENTS - expectedSubtotal,
    );
    expect(selectCartTotal(rootLow)).toBe(expectedSubtotal + 1_990);

    cart = cartReducer(cart, applyCoupon('MINIE10'));
    const rootDiscounted = buildRootState(cart);
    expect(selectCartDiscountAmount(rootDiscounted)).toBe(
      Math.round((expectedSubtotal * 10) / 100),
    );

    cart = cartReducer(cart, setShippingMethod('express'));
    const rootExpress = buildRootState(cart);
    expect(selectCartShippingCost(rootExpress)).toBe(4_990);

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
    expect(selectCartItemById(state1, secondProduct.id)).toBe(cart.items[1]);
    expect(selectCartStockWarningById(state1, secondProduct.id)).toBeNull();
    expect(selectCartSubtotal.recomputations()).toBe(1);
    expect(selectCartTotal.recomputations()).toBe(1);

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
