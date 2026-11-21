import { describe, expect, it, vi } from 'vitest';
import { PRODUCTS_MOCK } from '../../data/products';
import { createAppStore, hydrateCartState } from '../index';
import {
  CART_ITEMS_STORAGE_KEY,
  CART_PREFS_STORAGE_KEY,
} from '../persistence/cartStorage';
import cartReducer, {
  addToCart,
  applyCoupon,
  clearCart,
  closeCart,
  initialCartState,
  openCart,
  removeCoupon,
  removeFromCart,
  setCouponInput,
  setOrderNote,
  setShippingMethod,
  setStockWarning,
  toggleCart,
  updateQuantity,
  type CartState,
} from './cartSlice';

function deepFreeze<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) return obj;
  Object.freeze(obj);
  Object.values(obj as Record<string, unknown>).forEach((value) => {
    if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return obj;
}

describe('cartSlice pure functional reducers & immutability', () => {
  const productA = PRODUCTS_MOCK[0];
  const productB = PRODUCTS_MOCK[1];

  it('adds items immutably without mutating frozen previous state', () => {
    const frozenInitial = deepFreeze({ ...initialCartState });
    const afterFirst = cartReducer(
      frozenInitial,
      addToCart({ product: productA, quantity: 2 }),
    );

    expect(afterFirst).not.toBe(frozenInitial);
    expect(afterFirst.items).toHaveLength(1);
    expect(afterFirst.items[0].id).toBe(productA.id);
    expect(afterFirst.items[0].quantity).toBe(2);
    expect(afterFirst.isOpen).toBe(true);
    expect(frozenInitial.items).toHaveLength(0);

    deepFreeze(afterFirst);
    const afterSecond = cartReducer(afterFirst, addToCart(productB));

    expect(afterSecond.items).toHaveLength(2);
    expect(afterSecond.items[0]).toBe(afterFirst.items[0]);
    expect(afterSecond.items[1].id).toBe(productB.id);
    expect(afterSecond.items[1].quantity).toBe(1);
  });

  it('rejects out-of-stock (stock <= 0) products and sanitizes NaN/non-positive quantities', () => {
    const outOfStockProduct = { ...productA, stock: 0 };
    const afterZeroStock = cartReducer(
      initialCartState,
      addToCart(outOfStockProduct),
    );
    expect(afterZeroStock).toBe(initialCartState);
    expect(afterZeroStock.items).toHaveLength(0);

    const afterNaNAdd = cartReducer(
      initialCartState,
      addToCart({ product: productA, quantity: Number.NaN }),
    );
    expect(afterNaNAdd.items[0].quantity).toBe(1);

    const afterNegativeAdd = cartReducer(
      afterNaNAdd,
      addToCart({ product: productA, quantity: -5 }),
    );
    expect(afterNegativeAdd.items[0].quantity).toBe(2);

    const afterNaNUpdate = cartReducer(
      afterNegativeAdd,
      updateQuantity({ id: productA.id, quantity: Number.NaN }),
    );
    expect(afterNaNUpdate).toBe(afterNegativeAdd);
  });

  it('clamps addToCart quantity at product.stock and preserves items ref when already maxed', () => {
    const state1 = cartReducer(
      initialCartState,
      addToCart({ product: productA, quantity: productA.stock + 5 }),
    );

    expect(state1.items[0].quantity).toBe(productA.stock);
    expect(state1.stockWarnings[productA.id]).toContain(`${productA.stock}`);

    deepFreeze(state1);
    const state2 = cartReducer(
      state1,
      addToCart({ product: productA, quantity: 1 }),
    );
    expect(state2.items).toBe(state1.items);
    expect(state2.items[0].quantity).toBe(productA.stock);
    expect(state2.stockWarnings[productA.id]).toContain('Max stock reached');
  });

  it('preserves structural sharing for untouched items on updateQuantity', () => {
    let state = cartReducer(initialCartState, addToCart(productA));
    state = cartReducer(state, addToCart(productB));
    deepFreeze(state);

    const updated = cartReducer(
      state,
      updateQuantity({ id: productA.id, quantity: 3 }),
    );

    expect(updated.items[0]).not.toBe(state.items[0]);
    expect(updated.items[0].quantity).toBe(3);
    expect(updated.items[1]).toBe(state.items[1]);
  });

  it('clamps updateQuantity between 1 and stock and returns same reference on no-op', () => {
    const withItem = cartReducer(initialCartState, addToCart(productA));
    deepFreeze(withItem);

    const clampedLow = cartReducer(
      withItem,
      updateQuantity({ id: productA.id, quantity: 0 }),
    );
    expect(clampedLow).toBe(withItem);

    const clampedHigh = cartReducer(
      withItem,
      updateQuantity({ id: productA.id, quantity: productA.stock + 10 }),
    );
    expect(clampedHigh.items[0].quantity).toBe(productA.stock);
    expect(clampedHigh.stockWarnings[productA.id]).toContain(
      `Only ${productA.stock} units in stock.`,
    );
  });

  it('handles setStockWarning, removeFromCart, and clearCart immutably', () => {
    let state = cartReducer(initialCartState, addToCart(productA));
    state = cartReducer(state, addToCart(productB));
    state = cartReducer(
      state,
      setStockWarning({ id: productA.id, message: 'Low stock' }),
    );
    state = cartReducer(state, applyCoupon('MINIE10'));
    state = cartReducer(state, setOrderNote('Leave at desk'));
    deepFreeze(state);

    const afterRemove = cartReducer(state, removeFromCart(productA.id));
    expect(afterRemove.items).toHaveLength(1);
    expect(afterRemove.items[0]).toBe(state.items[1]);
    expect(afterRemove.stockWarnings[productA.id]).toBeUndefined();

    const cleared = cartReducer(state, clearCart());
    expect(cleared.items).toEqual([]);
    expect(cleared.stockWarnings).toEqual({});
    expect(cleared.appliedCoupon).toBeNull();
    expect(cleared.couponInput).toBe('');
    expect(cleared.orderNote).toBe('');
  });

  it('validates promo coupons (MINIE10, MINIE20, FREESHIP, empty, invalid) and removal', () => {
    const emptyErr = cartReducer(initialCartState, applyCoupon(undefined));
    expect(emptyErr.couponError).toBe('Enter a promo code to apply.');

    const invalidErr = cartReducer(initialCartState, applyCoupon('nope'));
    expect(invalidErr.couponError).toContain('NOPE');
    expect(invalidErr.appliedCoupon).toBeNull();

    const typing = cartReducer(invalidErr, setCouponInput('minie10'));
    expect(typing.couponError).toBeNull();
    expect(typing.couponInput).toBe('minie10');

    const applied = cartReducer(typing, applyCoupon(undefined));
    expect(applied.couponInput).toBe('MINIE10');
    expect(applied.appliedCoupon?.discountPercent).toBe(10);
    expect(applied.couponError).toBeNull();

    const appliedFreeship = cartReducer(applied, applyCoupon('freeship'));
    expect(appliedFreeship.appliedCoupon?.freeShipping).toBe(true);

    const removed = cartReducer(appliedFreeship, removeCoupon());
    expect(removed.appliedCoupon).toBeNull();
    expect(removed.couponInput).toBe('');
  });

  it('updates shippingMethod, clamps orderNote to 200 chars, and toggles drawer', () => {
    const withShipping = cartReducer(
      initialCartState,
      setShippingMethod('express'),
    );
    expect(withShipping.shippingMethod).toBe('express');
    expect(cartReducer(withShipping, setShippingMethod('express'))).toBe(
      withShipping,
    );

    const longText = 'a'.repeat(250);
    const withNote = cartReducer(withShipping, setOrderNote(longText));
    expect(withNote.orderNote).toHaveLength(200);
    expect(cartReducer(withNote, setOrderNote(longText))).toBe(withNote);

    const opened = cartReducer(initialCartState, openCart());
    expect(opened.isOpen).toBe(true);
    expect(cartReducer(opened, openCart())).toBe(opened);

    const toggled = cartReducer(opened, toggleCart());
    expect(toggled.isOpen).toBe(false);

    const closed = cartReducer(opened, closeCart());
    expect(closed.isOpen).toBe(false);
    expect(cartReducer(closed, closeCart())).toBe(closed);
  });

  it('keeps cartReducer pure and persists add, update, remove, and clear across reloads', async () => {
    const pureResult: CartState = cartReducer(
      initialCartState,
      addToCart(productA),
    );
    expect(pureResult.items).toHaveLength(1);
    expect(window.localStorage.getItem(CART_ITEMS_STORAGE_KEY)).toBeNull();

    const store = createAppStore();
    store.dispatch(addToCart({ product: productA, quantity: 2 }));
    store.dispatch(addToCart({ product: productB, quantity: 1 }));
    store.dispatch(updateQuantity({ id: productA.id, quantity: 3 }));
    store.dispatch(applyCoupon('MINIE20'));
    store.dispatch(setShippingMethod('express'));
    store.dispatch(setOrderNote('Ring doorbell'));

    // Allow debounced orderNote listener (250ms) to flush
    await new Promise((resolve) => setTimeout(resolve, 300));

    let hydrated = hydrateCartState();
    expect(hydrated.items).toHaveLength(2);
    expect(hydrated.items[0].quantity).toBe(3);
    expect(hydrated.appliedCoupon?.code).toBe('MINIE20');
    expect(hydrated.shippingMethod).toBe('express');
    expect(hydrated.orderNote).toBe('Ring doorbell');

    // Removing an item persists and does not return after reload
    store.dispatch(removeFromCart(productA.id));
    hydrated = hydrateCartState();
    expect(hydrated.items).toHaveLength(1);
    expect(hydrated.items[0].id).toBe(productB.id);

    // Clearing the cart persists empty items and cleared prefs
    store.dispatch(clearCart());
    hydrated = hydrateCartState();
    expect(hydrated.items).toEqual([]);
    expect(hydrated.appliedCoupon).toBeNull();
    expect(hydrated.orderNote).toBe('');
  });

  it('rejects tampered/non-finite localStorage items and invalid coupons safely', () => {
    window.localStorage.setItem(
      CART_ITEMS_STORAGE_KEY,
      JSON.stringify([
        {
          id: productA.id,
          name: productA.name,
          price: { ...productA.price, final_price: null },
          image: productA.image,
          category: productA.category,
          stock: 5,
          quantity: 1,
        },
        {
          id: productA.id,
          name: productA.name,
          price: productA.price,
          image: productA.image,
          category: productA.category,
          stock: 5,
          quantity: -2,
        },
        {
          id: productA.id,
          name: productA.name,
          price: productA.price,
          image: productA.image,
          category: productA.category,
          stock: 5,
          quantity: 12,
        },
      ]),
    );

    window.localStorage.setItem(
      CART_PREFS_STORAGE_KEY,
      JSON.stringify({
        appliedCoupon: {
          code: 'MINIE10',
          label: 'Tampered',
          discountPercent: 999,
        },
        shippingMethod: 'express',
        orderNote: 'ok',
      }),
    );

    let hydrated = hydrateCartState();
    expect(hydrated.items).toEqual([]);
    expect(hydrated.appliedCoupon).toBeNull();
    expect(hydrated.shippingMethod).toBe('express');

    window.localStorage.setItem(
      CART_PREFS_STORAGE_KEY,
      JSON.stringify({
        appliedCoupon: {
          code: 'FAKE99',
          label: '99% off',
          discountPercent: 99,
        },
      }),
    );
    hydrated = hydrateCartState();
    expect(hydrated.appliedCoupon).toBeNull();
  });

  it('falls back safely when localStorage contains malformed JSON', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.localStorage.setItem(CART_ITEMS_STORAGE_KEY, '{bad-json');
    window.localStorage.setItem(CART_PREFS_STORAGE_KEY, 'not-json');

    const hydrated = hydrateCartState();
    expect(hydrated.items).toEqual([]);
    expect(hydrated.shippingMethod).toBe('standard');
    expect(hydrated.appliedCoupon).toBeNull();
    expect(hydrated.orderNote).toBe('');
    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });
});
