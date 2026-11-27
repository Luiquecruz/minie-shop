import {
  combineReducers,
  configureStore,
  createListenerMiddleware,
  isAnyOf,
} from '@reduxjs/toolkit';
import currencyReducer, {
  initialCurrencyState,
  setCurrency,
  type CurrencyState,
} from './slices/currencySlice';
import cartReducer, {
  addToCart,
  applyCartQuote,
  applyCoupon,
  clearCart,
  initialCartState,
  removeCoupon,
  removeFromCart,
  setOrderNote,
  setShippingMethod,
  updateQuantity,
  type CartState,
} from './slices/cartSlice';
import {
  loadPersistedCartItems,
  loadPersistedCartPrefs,
  savePersistedCartItems,
  savePersistedCartPrefs,
} from './persistence/cartStorage';
import {
  loadPersistedCurrency,
  savePersistedCurrency,
} from './persistence/currencyStorage';

const rootReducer = combineReducers({
  currency: currencyReducer,
  cart: cartReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export function hydrateCurrencyState(): CurrencyState {
  return {
    ...initialCurrencyState,
    currentCurrency: loadPersistedCurrency(),
  };
}

export function hydrateCartState(): CartState {
  const items = loadPersistedCartItems();
  const prefs = loadPersistedCartPrefs();
  return {
    ...initialCartState,
    items,
    appliedCoupon: prefs.appliedCoupon,
    couponInput: prefs.appliedCoupon?.code ?? '',
    shippingMethod: prefs.shippingMethod,
    orderNote: prefs.orderNote,
  };
}

function persistPrefsFromState(state: RootState): void {
  savePersistedCartPrefs({
    appliedCoupon: state.cart.appliedCoupon,
    shippingMethod: state.cart.shippingMethod,
    orderNote: state.cart.orderNote,
  });
}

/**
 * Creates a Redux store instance with listener-based localStorage persistence
 * so reducers remain 100% pure functions without side effects.
 */
export function createAppStore(preloadedState?: Partial<RootState>) {
  const cartPersistenceListener = createListenerMiddleware();

  cartPersistenceListener.startListening({
    matcher: isAnyOf(
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      applyCartQuote,
    ),
    effect: (_action, listenerApi) => {
      const state = listenerApi.getState() as RootState;
      savePersistedCartItems(state.cart.items);
    },
  });

  cartPersistenceListener.startListening({
    actionCreator: setCurrency,
    effect: (_action, listenerApi) => {
      const state = listenerApi.getState() as RootState;
      savePersistedCurrency(state.currency.currentCurrency);
    },
  });

  cartPersistenceListener.startListening({
    matcher: isAnyOf(applyCoupon, removeCoupon, setShippingMethod, clearCart),
    effect: (_action, listenerApi) => {
      persistPrefsFromState(listenerApi.getState() as RootState);
    },
  });

  cartPersistenceListener.startListening({
    actionCreator: setOrderNote,
    effect: async (_action, listenerApi) => {
      listenerApi.cancelActiveListeners();
      const page = typeof window === 'undefined' ? undefined : window;
      const persist = () => persistPrefsFromState(listenerApi.getState() as RootState);
      const flush = () => {
        if (listenerApi.signal.aborted) return;
        persist();
        listenerApi.cancel();
      };

      page?.addEventListener('pagehide', flush, { once: true });
      try {
        await listenerApi.delay(250);
        persist();
      } finally {
        page?.removeEventListener('pagehide', flush);
      }
    },
  });

  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(cartPersistenceListener.middleware),
  });
}

export const store = createAppStore({
  currency: hydrateCurrencyState(),
  cart: hydrateCartState(),
});

export type AppStore = typeof store;
export type AppDispatch = typeof store.dispatch;

export default store;
