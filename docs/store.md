# Redux Store & Slices Inventory (Incremental)

Tracks global state configuration, typed hooks, slices, memoized selectors, actions, and `localStorage` persistence under `src/store/`.

---

## Store Configuration (`src/store/index.ts`)

```ts
export function createAppStore(preloadedState?: Partial<RootState>) {
  // Attaches createListenerMiddleware for minieshop_cart & minieshop_cart_prefs persistence
  return configureStore({ reducer: rootReducer, preloadedState, middleware: ... });
}

export const store = createAppStore({
  cart: hydrateCartState(),
});
```

## Pre-Typed Redux Hooks (`src/store/hooks.ts`)

```ts
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

---

## Summary Table

| Slice / Module | Path | Storage Key | State Keys |
| :--- | :--- | :--- | :--- |
| `cart` | `src/store/slices/cartSlice.ts` | `minieshop_cart`, `minieshop_cart_prefs` | `items`, `isOpen`, `stockWarnings`, `couponInput`, `appliedCoupon`, `couponError`, `shippingMethod`, `orderNote` |
| `cartSelectors` | `src/store/selectors/cartSelectors.ts` | — | Memoized `createSelector` derivations |
| `cartStorage` | `src/store/persistence/cartStorage.ts` | `minieshop_cart`, `minieshop_cart_prefs` | Safe `localStorage` read/write & type guards |
| `currency` | `src/store/slices/currencySlice.ts` | `minieshop_currency` | `currentCurrency` |

---

## Slice & Selector Details

### `cartSlice` (`src/store/slices/cartSlice.ts`)
- **Purity & Immutability:** All reducers are pure functions returning new immutable snapshots with structural sharing for untouched `CartItem` objects and zero `localStorage` side effects (persistence is handled by `createListenerMiddleware` in `src/store/index.ts`).
- **State (`CartState`):**
  - `items`: `CartItem[]` hydrated via `hydrateCartState()` from `localStorage.getItem('minieshop_cart')`
  - `isOpen`: `boolean` (`false`)
  - `stockWarnings`: `StockWarningsMap` (`Record<number, string>`)
  - `couponInput`: `string`
  - `appliedCoupon`: `AppliedCoupon | null` (`MINIE10`, `MINIE20`, `FREESHIP`)
  - `couponError`: `string | null`
  - `shippingMethod`: `ShippingMethodId` (`'standard' | 'express' | 'pickup'`)
  - `orderNote`: `string` (`maxLength = 200`)
- **Reducers & Actions:**
<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:cb29c95f3b418e84c72d82827deefb0b3d1c0527b89cb24e63fcca9d7b6b2572 -->

  - `addToCart`, `updateQuantity`, `setStockWarning`, `removeFromCart`, `clearCart`, `setCouponInput`, `applyCoupon`, `removeCoupon`, `setShippingMethod`, `setOrderNote`, `openCart`, `closeCart`, `toggleCart`.
- **Stock & Note Persistence:** Adding an existing item refreshes its normalized stock and reuses the line item only when quantity and stock are unchanged. Order note edits use a 250 ms debounce; page hide flushes the latest pending note through checkout preference persistence.

<!-- /coderabbit-ai-generated:v1 -->

### `cartSelectors` (`src/store/selectors/cartSelectors.ts`)
- **Base Input Selectors:** `selectCartState`, `selectCartItems`, `selectIsCartOpen`, `selectCartStockWarnings`, `selectCartCouponInput`, `selectCartAppliedCoupon`, `selectCartCouponError`, `selectCartShippingMethod`, `selectCartOrderNote`.
- **Memoized Selectors (`createSelector`):**
  - `selectCartItemIds` -> `number[]`
  - `selectCartItemsByIdMap` -> `Record<number, CartItem>` (`selectCartItemById(state, id)` O(1) lookup)
  - `selectCartStockWarningById(state, id)` -> `string | null`
  - `selectCartHasItems` -> `boolean`
  - `selectCartCount` -> `number`
  - `selectCartSubtotal` -> `number`
  - `selectCartDiscountAmount` -> `number`
  - `selectCartQualifiesForFreeStandardShipping` -> `boolean` (`>= 500 BRL`)
  - `selectCartHasFreeShippingCoupon` -> `boolean`
  - `selectCartShippingCost` -> `number`
  - `selectCartFreeShippingRemaining` -> `number`
  - `selectCartTotal` -> `number`

### `currencySlice` (`src/store/slices/currencySlice.ts`)
- **State (`CurrencyState`):**
  - `currentCurrency`: `CurrencyCode` hydrated from `localStorage.getItem('minieshop_currency')` when validated via `isCurrencyCode(stored)`; defaults to `DEFAULT_CURRENCY` (`'BRL'`).
- **Reducers & Actions:**
  - `setCurrency(PayloadAction<CurrencyCode>)`: Validates with `isCurrencyCode`, updates `currentCurrency`, and persists to `localStorage`.
- **Selectors (accepting `RootState`):**
  - `selectCurrentCurrency` -> `CurrencyCode`
  - `selectCurrencyConfig` -> `CurrencyConfig`
