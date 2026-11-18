# Redux Store & Slices Inventory (Incremental)

Tracks global state configuration, slices, actions, selectors, and persistence keys under `src/store/`.

---

## Store Configuration (`src/store/index.js`)

```js
configureStore({
  reducer: {
    currency: currencyReducer,
    cart: cartReducer,
  },
})
```

---

## Summary Table

| Slice | Path | Storage Key | State Keys |
| :--- | :--- | :--- | :--- |
| `cart` | `src/store/slices/cartSlice.js` | `minieshop_cart` | `items`, `isOpen`, `stockWarnings` |
| `currency` | `src/store/slices/currencySlice.js` | `minieshop_currency` | `currentCurrency` |

---

## Slice Details

### `cartSlice` (`src/store/slices/cartSlice.js`)
- **Initial State:**
  - `items`: Hydrated from `localStorage.getItem('minieshop_cart')` (validated via `Array.isArray`, falls back to `[]`).
  - `isOpen`: `false`
  - `stockWarnings`: `{}` (`{ [productId]: warningMessage }`)
- **Reducers & Actions:**
  - `addToCart({ product, quantity })` (also supports direct `product` payload): Adds or increments item clamped to `maxStock` (default `99` if `product.stock` is not a number), records `stockWarnings[product.id]` if capped, sets `state.isOpen = true`, and persists `items`.
  - `updateQuantity({ id, quantity })`: Clamps quantity between `1` and `maxStock`, updates/clears `stockWarnings[id]`, and persists `items`.
  - `setStockWarning({ id, message })`: Sets or deletes `stockWarnings[id]`.
  - `removeFromCart(id)`: Filters item out, clears warning, and persists `items`.
  - `clearCart()`: Empties `items`, resets `stockWarnings`, and persists `[]`.
  - `openCart()`, `closeCart()`, `toggleCart()`: Controls `state.isOpen`.
- **Selectors:**
  - `selectCartItems` -> `state.cart.items`
  - `selectIsCartOpen` -> `state.cart.isOpen`
  - `selectCartStockWarnings` -> `state.cart.stockWarnings`
  - `selectCartCount` -> sum of `item.quantity`
  - `selectCartSubtotal` -> sum of `(item.price?.final_price || 0) * item.quantity`

### `currencySlice` (`src/store/slices/currencySlice.js`)
- **Initial State:**
  - `currentCurrency`: Hydrated from `localStorage.getItem('minieshop_currency')` if present in `SUPPORTED_CURRENCIES`; defaults to `DEFAULT_CURRENCY` (`'BRL'`).
- **Reducers & Actions:**
  - `setCurrency(currencyCode)`: Validates against `SUPPORTED_CURRENCIES`, updates `currentCurrency`, and persists to `localStorage`.
- **Selectors:**
  - `selectCurrentCurrency` -> `state.currency.currentCurrency`
  - `selectCurrencyConfig` -> `SUPPORTED_CURRENCIES[currentCurrency] || SUPPORTED_CURRENCIES[DEFAULT_CURRENCY]`
