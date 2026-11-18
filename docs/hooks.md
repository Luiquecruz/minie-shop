# Custom Hooks Inventory (Incremental)

Tracks all custom React hooks in `src/hooks/`.

---

## Summary Table

| Hook | Path | Primary Responsibility | Dependencies |
| :--- | :--- | :--- | :--- |
| `useCart` | `src/hooks/useCart.ts` | Cart state & actions facade | `store/hooks`, `cartSlice` |
| `useCurrency` | `src/hooks/useCurrency.ts` | Currency state, switching & formatting | `store/hooks`, `currencySlice`, `utils/currency` |
| `useFetch<T>` | `src/hooks/useFetch.ts` | Generic debounced async fetching with `AbortController` | React `useState`, `useEffect` |

---

## Hook Details

### `useCart` (`src/hooks/useCart.ts`)
- **Purpose:** Encapsulates Redux `cart` selectors (`useAppSelector`) and typed action dispatchers (`useAppDispatch`) behind `UseCartReturn`.
- **Returns (`UseCartReturn`):**
  - `items`: `CartItem[]`
  - `isOpen`: `boolean`
  - `cartCount`: `number`
  - `subtotal`: `number` (in `BRL`)
  - `stockWarnings`: `StockWarningsMap` (`Record<number, string>`)
  - `addToCart(product: Product, quantity?: number): void`
  - `updateQuantity(id: number, quantity: number): void`
  - `setStockWarning(id: number, message: string | null): void`
  - `removeFromCart(id: number): void`
  - `clearCart(): void`
  - `openCart(): void`
  - `closeCart(): void`
  - `toggleCart(): void`

### `useCurrency` (`src/hooks/useCurrency.ts`)
- **Purpose:** Exposes active store currency, configuration, switcher, and BRL-to-target formatting helpers via `UseCurrencyReturn`.
- **Returns (`UseCurrencyReturn`):**
  - `currentCurrency`: `CurrencyCode` (`'BRL' | 'USD' | 'EUR'`)
  - `currencyConfig`: `CurrencyConfig`
  - `changeCurrency(currencyCode: CurrencyCode): void`
  - `formatPrice(valueInBrl: number): string` (via `formatCurrencyWithCode`)
  - `convertPrice(valueInBrl: number): number` (via `convertCurrency`)
  - `supportedCurrencies`: `Record<CurrencyCode, CurrencyConfig>`

### `useFetch<T>` (`src/hooks/useFetch.ts`)
- **Purpose:** Generic debounced async data fetching hook preventing race conditions via `AbortController` and `useEffect` cleanup.
- **Overloaded Signatures:**
  ```ts
  export function useFetch<T>(
    fetcher: UseFetchFetcher<T>,
    query: string,
    options: UseFetchOptionsWithInitial<T>,
  ): AsyncFetchState<T>;

  export function useFetch<T>(
    fetcher: UseFetchFetcher<T>,
    query: string,
    options?: UseFetchOptionsOptional<T>,
  ): AsyncFetchState<T | undefined>;
  ```
- **Return Type (`AsyncFetchState<T>`):** Hybrid discriminated union supporting both `status` narrowing and `{ data, isLoading, error }` destructuring:
  - `{ status: 'idle'; data: T; error: null; isLoading: false }`
  - `{ status: 'loading'; data: T; error: null; isLoading: true }`
  - `{ status: 'success'; data: T; error: null; isLoading: false }`
  - `{ status: 'error'; data: T; error: Error; isLoading: false }`
- **Cancellation & Error Behavior:** Clears pending `setTimeout` and invokes `controller.abort()` on cleanup; ignores `DOMException` (`AbortError`) or aborted signals; normalizes non-`Error` throws into `Error`.
