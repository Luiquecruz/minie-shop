# Custom Hooks Inventory (Incremental)

Tracks all custom React hooks in `src/hooks/`.

---

## Summary Table

| Hook | Path | Primary Responsibility | Dependencies |
| :--- | :--- | :--- | :--- |
| `useCart` | `src/hooks/useCart.ts` | Cart state & actions facade | `store/hooks`, `cartSlice` |
| `useCurrency` | `src/hooks/useCurrency.ts` | Currency state, switching & formatting | `store/hooks`, `currencySlice`, `utils/currency` |
| `useDebounce<T>` | `src/hooks/useDebounce.ts` | Generic value debouncing with timer cleanup | React `useState`, `useEffect` |
| `useProductsQuery` | `src/hooks/useProducts.ts` | Paginated, filtered catalog query (`keepPreviousData`) | `@tanstack/react-query`, `queryKeys`, `productsApi` |
| `useCategoriesQuery` | `src/hooks/useProducts.ts` | Cached catalog categories query (`5m` staleTime) | `@tanstack/react-query`, `queryKeys`, `productsApi` |
| `useProductQuery` | `src/hooks/useProducts.ts` | Single PDP product detail query | `@tanstack/react-query`, `queryKeys`, `productsApi` |
| `useRelatedProductsQuery` | `src/hooks/useProducts.ts` | Dependent PDP related products query | `@tanstack/react-query`, `queryKeys`, `productsApi` |
| `useProductSearchQuery` | `src/hooks/useProducts.ts` | Cached SearchBar autocomplete query (`1m` staleTime) | `@tanstack/react-query`, `queryKeys`, `productsApi` |
| `useStockValidationQuery` | `src/hooks/useProducts.ts` | MiniCart stock validation query (`30s` staleTime) | `@tanstack/react-query`, `queryKeys`, `productsApi` |
| `useFavorites` | `src/hooks/useFavorites.ts` | Favorites query, optimistic toggle & rollback facade | `@tanstack/react-query`, `queryKeys`, `productsApi` |

---

## Hook Details

### `useCart` (`src/hooks/useCart.ts`)
- **Purpose:** Encapsulates Redux `cart` selectors (`useAppSelector`) and typed action dispatchers (`useAppDispatch`) behind `UseCartReturn`.
- **Returns (`UseCartReturn`):** `items`, `isOpen`, `cartCount`, `subtotal`, `stockWarnings`, `addToCart`, `updateQuantity`, `setStockWarning`, `removeFromCart`, `clearCart`, `openCart`, `closeCart`, `toggleCart`.

### `useCurrency` (`src/hooks/useCurrency.ts`)
- **Purpose:** Exposes active store currency, configuration, switcher, and BRL-to-target formatting helpers via `UseCurrencyReturn`.
- **Returns (`UseCurrencyReturn`):** `currentCurrency`, `currencyConfig`, `changeCurrency`, `formatPrice`, `convertPrice`, `supportedCurrencies`.

### `useDebounce<T>` (`src/hooks/useDebounce.ts`)
- **Signature:** `useDebounce<T>(value: T, delayMs: number = 300): T`
- **Purpose:** Delays propagation of rapidly changing values (such as search input or cart item quantity) and cleans up pending timers on change or unmount.

### Catalog & Product Query Hooks (`src/hooks/useProducts.ts`)
- `useProductsQuery(filters: ProductListFilters)`: Uses `queryKeys.products.list(filters)`, `placeholderData: keepPreviousData`, and forwards `signal` to `productsApi.getProducts`.
- `useCategoriesQuery()`: Uses `queryKeys.categories.all` with `staleTime: 5 * 60 * 1000`.
- `useProductQuery(id: string | undefined)`: Uses `queryKeys.products.detail(id ?? '')` with `enabled: Boolean(id)`.
- `useRelatedProductsQuery(productId, category, limit = 4)`: Dependent query enabled when both `productId` and `category` are resolved.
- `useProductSearchQuery(debouncedQuery, limit = 6)`: Enabled when `debouncedQuery.trim().length >= 1` with `staleTime: 60 * 1000`.
- `useStockValidationQuery(productId, debouncedQuantity, enabled)`: Enabled when `enabled && debouncedQuantity >= 1`, `staleTime: 30 * 1000`, `retry: 0`.

### Favorites Hooks (`src/hooks/useFavorites.ts`)
- `useFavoritesQuery()`: Reads persisted favorite IDs under `queryKeys.favorites.all`.
- `useToggleFavoriteMutation()`: Optimistically toggles `productId` in `onMutate` after cancelling in-flight reads. Writes run in order, and settlement projects pending toggles over the latest confirmed IDs. It invalidates `favoritesOnly: true` product lists on settlement and refetches `queryKeys.favorites.all` once the queue drains.
- `useFavorites(onFavoriteError?)`: Facade returning `{ favoriteIds, favoritesCount, isFavorite, toggleFavorite, isPending, error, resetError }`.
