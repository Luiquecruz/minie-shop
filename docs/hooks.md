# Custom Hooks Inventory (Incremental)

Tracks all custom React hooks in `src/hooks/`.

---

## Summary Table

| Hook | Path | Primary Responsibility | Dependencies |
| :--- | :--- | :--- | :--- |
| `useCart` | `src/hooks/useCart.js` | Cart state & actions facade | `react-redux`, `cartSlice` |
| `useCurrency` | `src/hooks/useCurrency.js` | Currency state, switching & formatting | `react-redux`, `currencySlice`, `utils/currency` |
| `useFetch` | `src/hooks/useFetch.js` | Debounced async fetching with `AbortController` | React `useState`, `useEffect` |

---

## Hook Details

### `useCart` (`src/hooks/useCart.js`)
- **Purpose:** Encapsulates Redux `cart` selectors and action dispatchers behind a clean component API.
- **Returns:**
  - `items`: `Array` — Cart items (`id`, `name`, `price`, `image`, `category`, `stock`, `quantity`)
  - `isOpen`: `boolean` — Mini-cart drawer visibility
  - `cartCount`: `number` — Total sum of item quantities
  - `subtotal`: `number` — Sum of `(item.price?.final_price || 0) * item.quantity` in `BRL`
  - `stockWarnings`: `Record<string|number, string>` — Per-product warning map
  - `addToCart(product, quantity = 1)`
  - `updateQuantity(id, quantity)`
  - `setStockWarning(id, message)`
  - `removeFromCart(id)`
  - `clearCart()`
  - `openCart()`
  - `closeCart()`
  - `toggleCart()`

### `useCurrency` (`src/hooks/useCurrency.js`)
- **Purpose:** Exposes active store currency, configuration, switcher, and BRL-to-target formatting helpers.
- **Returns:**
  - `currentCurrency`: `'BRL' | 'USD' | 'EUR'`
  - `currencyConfig`: `{ code, label, symbol, rate, locale }`
  - `changeCurrency(currencyCode)`
  - `formatPrice(valueInBrl)`: `string` (via `formatCurrencyWithCode`)
  - `convertPrice(valueInBrl)`: `number` (via `convertCurrency`)
  - `supportedCurrencies`: `SUPPORTED_CURRENCIES` map

### `useFetch` (`src/hooks/useFetch.js`)
- **Purpose:** Generic debounced async data fetching hook preventing race conditions via `AbortController` and `useEffect` cleanup.
- **Signature:**
  ```js
  useFetch(fetcher, query, { debounceMs = 300, minQueryLength = 1, initialData = [] } = {})
  ```
  - `fetcher`: `(trimmedQuery, { signal }) => Promise<any>` (callers should memoize with `useCallback` to avoid unnecessary effect restarts)
- **Returns:**
  - `data`: `any[]` — Derived as `initialData` whenever `trimmedQuery.length < minQueryLength`
  - `isLoading`: `boolean`
  - `error`: `Error | null`
- **Cancellation Behavior:** Clears pending `setTimeout` and invokes `controller.abort()` on cleanup; silently ignores `AbortError` or aborted responses.
