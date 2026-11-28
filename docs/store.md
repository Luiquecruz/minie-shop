# Redux Store & Slices Inventory (Incremental)

Tracks global client state configuration, typed hooks, pure slices, memoized selectors, actions, and `localStorage` persistence under `apps/storefront/src/store/`.

---

## Store Configuration (`apps/storefront/src/store/index.ts`)

```ts
export function createAppStore(preloadedState?: Partial<RootState>) {
  // Attaches createListenerMiddleware for cart items, cart prefs (debounced + pagehide flush),
  // applyCartQuote snapshots, and currency persistence
  return configureStore({ reducer: rootReducer, preloadedState, middleware: ... });
}

export const store = createAppStore({
  cart: hydrateCartState(),
  currency: hydrateCurrencyState(),
});
```

## Pre-Typed Redux Hooks (`apps/storefront/src/store/hooks.ts`)

```ts
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

---

## Summary Table

| Slice / Module | Path | Storage Key | Responsibility / State Keys |
| :--- | :--- | :--- | :--- |
| `cart` *(frozen in Phase 7)* | `apps/storefront/src/store/slices/cartSlice.ts` | `minieshop_cart`, `minieshop_cart_prefs` | `items`, `isOpen`, `stockWarnings`, `couponInput`, `appliedCoupon`, `couponError`, `shippingMethod`, `shippingPricing`, `lastQuoteUpdatedAt`, `orderNote` |
| `cartConstants` | `apps/storefront/src/store/slices/cartConstants.ts` | — | `FREE_SHIPPING_THRESHOLD_CENTS`, `MAX_ORDER_NOTE_LENGTH`, `DEFAULT_FALLBACK_STOCK`, `SHIPPING_OPTIONS`, `PROMO_COUPONS` |
| `cartSelectors` | `apps/storefront/src/store/selectors/cartSelectors.ts` | — | Memoized `createSelector` derivations (`selectRecentCartProductIds`, totals, shipping, discounts) |
| `cartStorage` | `apps/storefront/src/store/persistence/cartStorage.ts` | `minieshop_cart`, `minieshop_cart_prefs` | Safe versioned (`v2`) `localStorage` read/write & runtime type guards |
| `currency` | `apps/storefront/src/store/slices/currencySlice.ts` | `minieshop_currency` | Pure slice holding `currentCurrency` (`'BRL' \| 'USD' \| 'EUR'`) |
| `currencyStorage` | `apps/storefront/src/store/persistence/currencyStorage.ts` | `minieshop_currency` | Safe `localStorage` hydration (`hydrateCurrencyState`) and persistence (`saveCurrencyPreference`) |

---

## Slice & Selector Details

### `cartSlice` (`apps/storefront/src/store/slices/cartSlice.ts`)
- **Purity, Immutability & Freeze Policy:** All reducers are pure functions returning immutable snapshots with structural sharing for untouched `CartItem` objects and zero `localStorage` side effects. Reducer business logic is frozen from Phase 7 onward; UI components access helpers and state exclusively via `apps/storefront/src/hooks/useCart.ts`.
- **State (`CartState`):**
  - `items`: `CartItem[]` (integer-cents `MoneyDTO` prices, UUID string IDs) hydrated via `hydrateCartState()`
  - `isOpen`: `boolean` (`false`)
  - `stockWarnings`: `StockWarningsMap` (`Record<string, string>`)
  - `couponInput`: `string`
  - `appliedCoupon`: `AppliedCoupon | null` (`MINIE10`, `MINIE20`, `FREESHIP`)
  - `couponError`: `string | null`
  - `shippingMethod`: `ShippingMethodId` (`'standard' | 'express' | 'pickup'`)
  - `shippingPricing`: `CartShippingPricing` (`currency`, `freeShippingThresholdCents`, `options`)
  - `lastQuoteUpdatedAt`: `number` (monotonic timestamp guard for `applyCartQuote`)
  - `orderNote`: `string` (`maxLength = 200`)
- **Actions:** `addToCart`, `updateQuantity`, `setStockWarning`, `removeFromCart`, `clearCart`, `setCouponInput`, `applyCoupon`, `removeCoupon`, `setShippingMethod`, `setOrderNote`, `openCart`, `closeCart`, `toggleCart`, `applyCartQuote`.
- **Persistence (`createListenerMiddleware`):** Persists cart items on mutations **including `applyCartQuote`** (so server-repriced cart snapshots survive reloads). Order note edits use a 250ms debounce with a `pagehide` flush.

### `cartSelectors` (`apps/storefront/src/store/selectors/cartSelectors.ts`)
- **Base Input Selectors:** `selectCartState`, `selectCartItems`, `selectIsCartOpen`, `selectCartStockWarnings`, `selectCartCouponInput`, `selectCartAppliedCoupon`, `selectCartCouponError`, `selectCartShippingMethod`, `selectCartShippingPricing`, `selectCartShippingOptions`, `selectCartFreeShippingThresholdCents`, `selectLastQuoteUpdatedAt`, `selectCartOrderNote`.
- **Memoized Selectors (`createSelector`):**
  - `selectCartItemIds` -> `string[]`
  - `selectRecentCartProductIds` -> `string[]` (up to `20` most recently added distinct product IDs for Cart cross-sell)
  - `selectCartItemsByIdMap` -> `Record<string, CartItem>` (`selectCartItemById(state, id)` O(1) lookup)
  - `selectCartStockWarningById(state, id)` -> `string | null`
  - `selectCartHasItems` -> `boolean`
  - `selectCartCount` -> `number`
  - `selectCartSubtotal` -> `number` (integer cents)
  - `selectCartDiscountAmount` -> `number` (integer cents)
  - `selectCartQualifiesForFreeStandardShipping` -> `boolean`
  - `selectCartHasFreeShippingCoupon` -> `boolean`
  - `selectCartShippingCost` -> `number` (integer cents)
  - `selectCartFreeShippingRemaining` -> `number` (integer cents)
  - `selectCartTotal` -> `number` (integer cents)

### `currencySlice` (`apps/storefront/src/store/slices/currencySlice.ts`)
- **Purity:** 100% pure reducer with zero `localStorage` side effects (hydration runs via `hydrateCurrencyState()` in `createAppStore()`, and persistence runs via `currencyPersistenceListener` in `createListenerMiddleware`).
- **State (`CurrencyState`):** `currentCurrency: CurrencyCode` (defaults to `DEFAULT_CURRENCY = 'BRL'`).
- **Actions:** `setCurrency(PayloadAction<CurrencyCode>)` — validates with `isCurrencyCode` before updating state.
- **Selectors:** `selectCurrentCurrency` -> `CurrencyCode`, `selectCurrencyConfig` -> `CurrencyConfig`.
