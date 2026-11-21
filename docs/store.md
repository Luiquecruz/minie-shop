# Redux Store & Slices Inventory (Incremental)

Tracks global state configuration, typed hooks, slices, actions, selectors, and persistence keys under `src/store/`.

---

## Store Configuration (`src/store/index.ts`)

```ts
export const store = configureStore({
  reducer: {
    currency: currencyReducer,
    cart: cartReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

## Pre-Typed Redux Hooks (`src/store/hooks.ts`)

```ts
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

---

## Summary Table

| Slice | Path | Storage Key | State Keys |
| :--- | :--- | :--- | :--- |
| `cart` | `src/store/slices/cartSlice.ts` | `minieshop_cart` | `items`, `isOpen`, `stockWarnings` |
| `currency` | `src/store/slices/currencySlice.ts` | `minieshop_currency` | `currentCurrency` |

---

## Slice Details

### `cartSlice` (`src/store/slices/cartSlice.ts`)
- **State (`CartState`):**
  - `items`: `CartItem[]` hydrated from `localStorage.getItem('minieshop_cart')` (`unknown` parsed JSON filtered via `isValidCartItem` type guard, falling back to `[]`).
  - `isOpen`: `boolean` (`false`)
  - `stockWarnings`: `StockWarningsMap` (`Record<number, string>`)
- **Reducers & Actions:**
  - `addToCart(PayloadAction<AddToCartPayload>)`: Accepts `{ product, quantity? }` or direct `Product`, clamps to `maxStock` (default `99`), updates `stockWarnings[product.id]`, sets `state.isOpen = true`, and persists `items`.
  - `updateQuantity(PayloadAction<{ id: number; quantity: number }>)`: Clamps quantity between `1` and `maxStock`, updates/clears `stockWarnings[id]`, and persists `items`.
  - `setStockWarning(PayloadAction<{ id: number; message: string | null }>)`: Sets or deletes `stockWarnings[id]`.
  - `removeFromCart(PayloadAction<number>)`: Filters item out, clears warning, and persists `items`.
  - `clearCart()`: Empties `items`, resets `stockWarnings`, and persists `[]`.
  - `replaceCartItems(PayloadAction<CartItem[]>)`: Replaces `items`, prunes stale `stockWarnings`, and persists `items` (used to sync `CartPageProvider` changes back to Redux).
  - `openCart()`, `closeCart()`, `toggleCart()`: Controls `state.isOpen`.
- **Selectors (accepting `RootState`):**
  - `selectCartItems` -> `CartItem[]`
  - `selectIsCartOpen` -> `boolean`
  - `selectCartStockWarnings` -> `StockWarningsMap`
  - `selectCartCount` -> `number`
  - `selectCartSubtotal` -> `number`

### `currencySlice` (`src/store/slices/currencySlice.ts`)
- **State (`CurrencyState`):**
  - `currentCurrency`: `CurrencyCode` hydrated from `localStorage.getItem('minieshop_currency')` when validated via `isCurrencyCode(stored)`; defaults to `DEFAULT_CURRENCY` (`'BRL'`).
- **Reducers & Actions:**
  - `setCurrency(PayloadAction<CurrencyCode>)`: Validates with `isCurrencyCode`, updates `currentCurrency`, and persists to `localStorage`.
- **Selectors (accepting `RootState`):**
  - `selectCurrentCurrency` -> `CurrencyCode`
  - `selectCurrencyConfig` -> `CurrencyConfig`
