import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_PRODUCTS_DETAIL } from '../../test/fixtures/catalogFixture';
import { createAppStore, hydrateCartState } from '../index';
import {
  CART_ITEMS_STORAGE_KEY,
  CART_PREFS_STORAGE_KEY,
  CART_STORAGE_VERSION,
} from '../persistence/cartStorage';
import cartReducer, {
  addToCart,
  applyCartQuote,
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
  const productA = FIXTURE_PRODUCTS_DETAIL[0];
  const productB = FIXTURE_PRODUCTS_DETAIL[1];

  it('adds items immutably without mutating frozen previous state', () => {
    const frozenInitial = deepFreeze({ ...initialCartState });
    const afterFirst = cartReducer(
      frozenInitial,
      addToCart({ product: productA, quantity: 2 }),
    );

    expect(afterFirst).not.toBe(frozenInitial);
    expect(afterFirst.items).toHaveLength(1);
    expect(afterFirst.items[0].id).toBe(productA.id);
    expect(afterFirst.items[0].slug).toBe(productA.slug);
    expect(afterFirst.items[0].price.amount).toBe(productA.price.amount);
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

  it('rejects out-of-stock products and sanitizes NaN/non-positive quantities', () => {
    const outOfStockProduct = { ...productA, inStock: false };
    const afterOutOfStock = cartReducer(
      initialCartState,
      addToCart(outOfStockProduct),
    );
    expect(afterOutOfStock).toBe(initialCartState);
    expect(afterOutOfStock.items).toHaveLength(0);

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

  it('clamps addToCart quantity at stock bound and preserves items ref when already maxed', () => {
    const state1 = cartReducer(
      initialCartState,
      addToCart({ product: productA, quantity: 10, stock: 5 }),
    );

    expect(state1.items[0].quantity).toBe(5);
    expect(state1.stockWarnings[productA.id]).toContain('5');

    deepFreeze(state1);
    const state2 = cartReducer(
      state1,
      addToCart({ product: productA, quantity: 1, stock: 5 }),
    );
    expect(state2.items).toBe(state1.items);
    expect(state2.items[0].quantity).toBe(5);
    expect(state2.stockWarnings[productA.id]).toContain('Max stock reached');
  });

  it('refreshes stock when adding an existing item even if the quantity stays capped', () => {
    const state = cartReducer(
      initialCartState,
      addToCart({ product: productA, quantity: 5 }),
    );
    const updated = cartReducer(
      state,
      addToCart({ product: productA, quantity: 1, stock: 5.9 }),
    );

    expect(updated.items[0]).not.toBe(state.items[0]);
    expect(updated.items[0]).toMatchObject({ quantity: 5, stock: 5 });
    const incremented = cartReducer(
      updated,
      updateQuantity({ id: productA.id, quantity: 6 }),
    );
    expect(incremented.items).toBe(updated.items);
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
    const withItem = cartReducer(
      initialCartState,
      addToCart({ product: productA, quantity: 1, stock: 10 }),
    );
    deepFreeze(withItem);

    const clampedLow = cartReducer(
      withItem,
      updateQuantity({ id: productA.id, quantity: 0 }),
    );
    expect(clampedLow).toBe(withItem);

    const clampedHigh = cartReducer(
      withItem,
      updateQuantity({ id: productA.id, quantity: 20 }),
    );
    expect(clampedHigh.items[0].quantity).toBe(10);
    expect(clampedHigh.stockWarnings[productA.id]).toContain(
      'Only 10 units in stock.',
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

  it('keeps cartReducer pure and persists versioned v2 state across reloads', async () => {
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

    await new Promise((resolve) => setTimeout(resolve, 300));

    const persistedRaw = JSON.parse(
      window.localStorage.getItem(CART_ITEMS_STORAGE_KEY) ?? '{}',
    ) as { version?: number; items?: unknown[] };
    expect(persistedRaw.version).toBe(CART_STORAGE_VERSION);

    let hydrated = hydrateCartState();
    expect(hydrated.items).toHaveLength(2);
    expect(hydrated.items[0].quantity).toBe(3);
    expect(hydrated.appliedCoupon?.code).toBe('MINIE20');
    expect(hydrated.shippingMethod).toBe('express');
    expect(hydrated.orderNote).toBe('Ring doorbell');

    store.dispatch(removeFromCart(productA.id));
    hydrated = hydrateCartState();
    expect(hydrated.items).toHaveLength(1);
    expect(hydrated.items[0].id).toBe(productB.id);

    store.dispatch(clearCart());
    hydrated = hydrateCartState();
    expect(hydrated.items).toEqual([]);
    expect(hydrated.appliedCoupon).toBeNull();
    expect(hydrated.orderNote).toBe('');
  });

  it('safely discards legacy v1 localStorage cart payloads (numeric IDs / float prices)', () => {
    window.localStorage.setItem(
      CART_ITEMS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 1,
          name: 'Legacy Product',
          price: {
            regular_price: 299.9,
            special_price: null,
            final_price: 299.9,
            discount_percentage: 0,
            has_discount: false,
          },
          image: 'https://example.com/old.jpg',
          category: 'Eletrônicos',
          stock: 10,
          quantity: 2,
        },
      ]),
    );

    const hydrated = hydrateCartState();
    expect(hydrated.items).toEqual([]);
    expect(window.localStorage.getItem(CART_ITEMS_STORAGE_KEY)).toBeNull();
  });

  it('flushes the latest pending note on pagehide without a second write', async () => {
    vi.useFakeTimers();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    try {
      const store = createAppStore();
      store.dispatch(setOrderNote('First draft'));
      await vi.advanceTimersByTimeAsync(200);
      store.dispatch(setOrderNote('Latest draft'));
      await vi.advanceTimersByTimeAsync(200);
      expect(hydrateCartState().orderNote).toBe('');

      window.dispatchEvent(new Event('pagehide'));
      expect(hydrateCartState().orderNote).toBe('Latest draft');
      await vi.advanceTimersByTimeAsync(250);
      expect(setItem).toHaveBeenCalledTimes(1);
    } finally {
      setItem.mockRestore();
      vi.useRealTimers();
    }
  });

  it('rejects tampered v2 localStorage items and invalid coupons safely', () => {
    window.localStorage.setItem(
      CART_ITEMS_STORAGE_KEY,
      JSON.stringify({
        version: CART_STORAGE_VERSION,
        items: [
          {
            id: productA.id,
            slug: productA.slug,
            categorySlug: productA.category.slug,
            name: productA.name,
            price: { amount: -100, currency: 'BRL' },
            image: null,
            inStock: true,
            stock: 5,
            quantity: 1,
          },
          {
            id: productA.id,
            slug: productA.slug,
            categorySlug: productA.category.slug,
            name: productA.name,
            price: productA.price,
            image: null,
            inStock: true,
            stock: 5,
            quantity: 12,
          },
        ],
      }),
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

  it('applyCartQuote preserves structural sharing on no-op and reprices items/shipping without deleting out-of-stock items', () => {
    let state = cartReducer(initialCartState, addToCart({ product: productA, quantity: 2 }));
    state = cartReducer(state, addToCart({ product: productB, quantity: 1 }));

    const noopState = cartReducer(
      state,
      applyCartQuote({
        currency: 'BRL',
        items: [
          { productId: productA.id, price: productA.price, inStock: productA.inStock },
          { productId: productB.id, price: productB.price, inStock: productB.inStock },
        ],
        freeShippingThresholdCents: 50_000,
        shippingOptions: [
          { id: 'standard', basePriceCents: 1_990 },
          { id: 'express', basePriceCents: 4_990 },
          { id: 'pickup', basePriceCents: 0 },
        ],
      }),
    );
    expect(noopState).toBe(state);

    const usdState = cartReducer(
      state,
      applyCartQuote({
        currency: 'USD',
        items: [
          {
            productId: productA.id,
            price: { amount: 8_990, currency: 'USD' },
            inStock: true,
          },
          {
            productId: productB.id,
            price: { amount: 7_490, currency: 'USD' },
            inStock: false,
          },
        ],
        freeShippingThresholdCents: 10_000,
        shippingOptions: [
          { id: 'standard', basePriceCents: 490 },
          { id: 'express', basePriceCents: 990 },
          { id: 'pickup', basePriceCents: 0 },
        ],
      }),
    );

    expect(usdState.items).toHaveLength(2);
    expect(usdState.items[0].price).toEqual({ amount: 8_990, currency: 'USD' });
    expect(usdState.items[1].price).toEqual({ amount: 7_490, currency: 'USD' });
    expect(usdState.items[1].inStock).toBe(false);
    expect(usdState.stockWarnings[productB.id]).toMatch(/out of stock/i);
    expect(usdState.shippingPricing.currency).toBe('USD');
    expect(usdState.shippingPricing.freeShippingThresholdCents).toBe(10_000);

    // If a quote omits the currently selected shipping option ('express'), reconcile shippingMethod
    const expressSelected = cartReducer(usdState, setShippingMethod('express'));
    const partialShippingState = cartReducer(
      expressSelected,
      applyCartQuote({
        quote: {
          currency: 'EUR',
          items: [
            {
              productId: productA.id,
              price: { amount: 8_490, currency: 'EUR' },
              inStock: true,
            },
            {
              productId: productB.id,
              price: { amount: 6_990, currency: 'EUR' },
              inStock: true,
            },
          ],
          freeShippingThresholdCents: 9_500,
          shippingOptions: [
            { id: 'standard', basePriceCents: 450 },
            { id: 'pickup', basePriceCents: 0 },
          ],
        },
        updatedAt: 2_000,
      }),
    );
    expect(partialShippingState.shippingPricing.currency).toBe('EUR');
    expect(partialShippingState.shippingMethod).toBe('standard');
    expect(partialShippingState.shippingPricing.options.map((o) => o.id)).toEqual([
      'standard',
      'pickup',
    ]);

    // Older quote observation (updatedAt < lastQuoteUpdatedAt) is rejected
    const staleRejected = cartReducer(
      partialShippingState,
      applyCartQuote({
        quote: {
          currency: 'BRL',
          items: [
            {
              productId: productA.id,
              price: productA.price,
              inStock: true,
            },
          ],
          freeShippingThresholdCents: 50_000,
          shippingOptions: [{ id: 'standard', basePriceCents: 1_990 }],
        },
        updatedAt: 1_000,
      }),
    );
    expect(staleRejected).toBe(partialShippingState);
  });
});
