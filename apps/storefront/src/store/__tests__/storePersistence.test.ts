import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_PRODUCTS_DETAIL } from '../../test/fixtures/catalogFixture';
import {
  createAppStore,
  hydrateCartState,
  hydrateCurrencyState,
} from '../index';
import { addToCart, applyCartQuote } from '../slices/cartSlice';
import currencyReducer, {
  initialCurrencyState,
  setCurrency,
} from '../slices/currencySlice';
import { buildSearchQueryString } from '../../infrastructure/repositories/queryStrings';

describe('Pure currencySlice & Redux listener persistence', () => {
  it('keeps currencySlice reducer 100% pure without touching localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');

    const next = currencyReducer(initialCurrencyState, setCurrency('USD'));

    expect(next.currentCurrency).toBe('USD');
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
    getItemSpy.mockRestore();
  });

  it('persists currency changes via listenerMiddleware and hydrates via hydrateCurrencyState', () => {
    const store = createAppStore();
    expect(store.getState().currency.currentCurrency).toBe('BRL');

    store.dispatch(setCurrency('EUR'));
    expect(window.localStorage.getItem('minieshop_currency')).toBe('EUR');
    expect(hydrateCurrencyState().currentCurrency).toBe('EUR');
  });

  it('persists repriced cart items when applyCartQuote is dispatched', () => {
    const product = FIXTURE_PRODUCTS_DETAIL[0];
    const store = createAppStore();

    store.dispatch(addToCart({ product, quantity: 2 }));
    store.dispatch(
      applyCartQuote({
        currency: 'USD',
        items: [
          {
            productId: product.id,
            price: { amount: 4200, currency: 'USD' },
            inStock: true,
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

    const hydrated = hydrateCartState();
    expect(hydrated.items).toHaveLength(1);
    expect(hydrated.items[0].price).toEqual({ amount: 4200, currency: 'USD' });
    expect(hydrated.items[0].quantity).toBe(2);
  });

  it('serializes non-BRL currency in buildSearchQueryString and omits default BRL', () => {
    expect(buildSearchQueryString({ q: 'fone', currency: 'BRL' })).toBe('?q=fone');
    expect(buildSearchQueryString({ q: 'fone', currency: 'USD', limit: 24 })).toBe(
      '?q=fone&currency=USD&limit=24',
    );
  });
});
