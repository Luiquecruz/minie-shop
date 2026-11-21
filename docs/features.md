# Features Inventory (Incremental)

Tracks all implemented user-facing features, their entry points, dependencies, and evolution phase.

---

## Summary Matrix

| ID | Feature | Phase | Primary Files | Status |
| :--- | :--- | :--- | :--- | :--- |
| `F-01` | Product Catalog, Filtering & Pagination (PLP) | Phase 3 / Post-Phase 5 | `ProductListingPage.tsx`, `Pagination.tsx`, `ProductCard.tsx`, `Dropdown.tsx` | Implemented |
| `F-02` | Pricing & Discount Precedence Engine | Phase 3 | `utils/price.ts`, `PriceBox.tsx` | Implemented |
| `F-03` | Multi-Currency Engine & Persistence | Phase 3 | `utils/currency.ts`, `currencySlice.ts`, `useCurrency.ts`, `Navbar.tsx` | Implemented |
| `F-04` | Product Detail Page (PDP) & SEO | Phase 4 / Post-Phase 5 | `ProductDetailPage.tsx`, `useProducts.ts`, `App.tsx` | Implemented |
| `F-05` | Global Autocomplete Search | Phase 4 / Post-Phase 5 | `SearchBar.tsx`, `useDebounce.ts`, `useProducts.ts`, `api.ts` | Implemented |
| `F-06` | Floating Mini-Cart & Stock Guardrails | Phase 5 / Post-Phase 5 | `MiniCart.tsx`, `cartSlice.ts`, `useCart.ts`, `useProducts.ts` | Implemented |
| `F-07` | Incremental TypeScript Migration | Pre-Phase 6 | `tsconfig.json`, `src/types/*`, `src/store/hooks.ts`, all `src/**/*.ts(x)` | Implemented |
| `F-08` | React Query Caching, Optimistic Favorites & API Simulator | Post-Phase 5 | `src/query/*`, `useProducts.ts`, `useFavorites.ts`, `ApiDebugFab.tsx` | Implemented |
| `F-09` | Dedicated Cart Page (Increment 2: Pure Redux + Memoized Selectors) | Phase 6 (Inc. 2) | `CartPage.tsx`, `cartSlice.ts`, `cartSelectors.ts`, `cartStorage.ts`, `useCart.ts` | Implemented |
| `F-10` | Checkout Flow & Order Confirmation | Phase 6 (Inc. 3) | — | Planned |

---

## Feature Details

### F-01: Product Catalog, Filtering & Pagination (PLP)
- **Route:** `/` (and fallback `*`)
- **Capabilities:**
  - Displays 30 mock catalog products paginated (`12` per page) via `useProductsQuery` with `placeholderData: keepPreviousData` so page transitions do not flash skeletons.
  - Synchronizes `?page=&category=&sort=` in URL search parameters via `useSearchParams` so returning from a PDP preserves filters and reads directly from React Query cache.
  - Dynamic category chip filters loaded via `useCategoriesQuery()` (`All`, `Favorites` with live badge count, plus catalog categories).
  - Sorting via generic `Dropdown<ProductSortOption>` (`Default (Featured)`, `Lowest Price`, `Highest Price`, `Top Rated`, `Name (A - Z)`).
  - Initial 8-card skeleton loading state, error alert with React Query `refetch()` ("Try Again"), empty state with filter reset, and direct `Add to Cart` action.

### F-02: Pricing & Discount Precedence Engine
- **Capabilities:**
  - Evaluates `regular_price` vs. `special_price` via `calculatePrice()`.
  - Applies `special_price` as `final_price` only when it is a valid number `> 0` and `< regular_price`.
  - Computes rounded `discount_percentage` and renders strikethrough original price + discount badge in `PriceBox`.

### F-03: Multi-Currency Engine & Persistence
- **Capabilities:**
  - Supports `BRL` (base catalog currency, rate `1.0`), `USD` (rate `0.18`), and `EUR` (rate `0.16`).
  - Selector in `Navbar` dispatches `setCurrency` and persists choice under `localStorage` key `minieshop_currency` with `isCurrencyCode` runtime validation.
  - Formats values via `Intl.NumberFormat` according to target currency locale (`pt-BR`, `en-US`, `de-DE`).

### F-04: Product Detail Page (PDP) & SEO
- **Route:** `/product/:id`
- **Capabilities:**
  - Dynamic `<title>` and `<meta name="description">` via `react-helmet-async` (including "Product Not Found" and transient error states).
  - Breadcrumb navigation (`Catalog / <category> / <name>`).
  - Open masonry image gallery (4 aspect-ratio views per product) with mobile swipe hint.
  - Optimistic Favorite toggle button (`Save` / `Saved`) in the details header.
  - 3 accessible tabs (`Description`, `Manufacturer`, `Technical Specs` key-value grid).
  - Inline action buttons + sticky floating bottom action bar (`Add to Cart`, `Buy Now`) with toast feedback.
  - Related products grid (`limit = 4`) fetched via dependent `useRelatedProductsQuery()`.
  - Distinguishes `ProductNotFoundError` from transient/simulated errors, offering a **"Try Again"** (`refetch()`) button for recoverable errors.

### F-05: Global Autocomplete Search
- **Location:** `Navbar`
- **Capabilities:**
  - Uses `useDebounce(query, 300)` + `useProductSearchQuery(debouncedQuery, 6)` backed by `productsApi.searchProducts` with `AbortSignal` support.
  - Caches search results per normalized query term for 1 minute and shows inline error + **"Try Again"** recovery inside the dropdown on failure.
  - ARIA combobox pattern with `ArrowUp`, `ArrowDown`, `Enter`, `Escape` keyboard support, click-outside dismissal, match highlighting (`<mark>`), skeleton loading, and direct route navigation to `/product/:id`.

### F-06: Floating Mini-Cart & Stock Guardrails
- **Location:** `RootLayout` (mounted globally)
- **Capabilities:**
  - Automatically opens when an item is added (`addToCart` sets `isOpen = true`).
  - Persists cart items under `localStorage` key `minieshop_cart` with runtime schema validation (`isValidCartItem`).
  - Enforces min (`1`) and max (`product.stock`) bounds in both Redux reducers and UI controls.
  - Performs debounced (`300ms`) async stock validation via `useDebounce` + `useStockValidationQuery` per cart item.
  - Locks `document.body.style.overflow` while open, closes on `Escape` or backdrop click, and navigates to `/cart` on **View Full Cart** (keeping placeholder notice for **Proceed to Checkout** until Increment 2+).

### F-07: Incremental TypeScript Migration
- **Capabilities:**
  - Strict TypeScript (`"strict": true`, `"allowJs": false`, `"noUnusedLocals": true`, `"noUnusedParameters": true`, `"noFallthroughCasesInSwitch": true`) enforced via `npm run typecheck` and `npm run build`.
  - Zero explicit or implicit `any` enforced by Oxlint (`typescript/no-explicit-any: "error"`) and `tsconfig.json`.
  - Shared domain entities in `src/types/` (`currency.ts`, `product.ts`, `cart.ts`, `api.ts`) and co-located component prop interfaces.

### F-08: React Query Caching, Optimistic Favorites & API Simulator
- **Capabilities:**
  - Configured `QueryClient` (`staleTime: 2m`, `gcTime: 10m`, `refetchOnWindowFocus: false`, smart `retry: 2` with exponential backoff) and `ReactQueryDevtools` (`DEV` only, bottom-right).
  - Optimistic Favorites toggle (`useToggleFavoriteMutation`) on `ProductCard` and `ProductDetailPage`, persisted in `localStorage` (`minieshop_favorites`), with automatic cache rollback on mutation failure and targeted invalidation of `favorites` and `favoritesOnly` product lists.
  - Discreet bottom-left `ApiDebugFab` popover allowing live toggling of **Simulate Query Error**, **Simulate Favorite Error**, and **Invalidate Cache**.

### F-09: Dedicated Cart Page (Increment 2: Pure Redux + Memoized Selectors)
- **Route:** `/cart`
- **Capabilities:**
  - Migrated from monolithic Context + `useReducer` to pure immutable Redux Toolkit `cartSlice` reducers, memoized `createSelector` derivations (`cartSelectors.ts`), granular hooks (`useCart.ts`), and `React.memo` subcomponents, reducing measured React `<Profiler>` updates across 4 cart interactions from `70` to `16` (-77.1%).
  - Persists items (`minieshop_cart`) and checkout preferences (`minieshop_cart_prefs`) to `localStorage` via RTK `createListenerMiddleware` (`cartStorage.ts`) without side effects inside reducers.
  - Displays cart line items with quantity steppers, numeric bounds (`1..stock`), debounced stock validation (`useStockValidationQuery`), item removal, and Clear Cart.
  - Supports promo coupons (`MINIE10`, `MINIE20`, `FREESHIP`), shipping method selection (`Standard Delivery`, `Express Courier`, `Store Pickup`), free-shipping threshold progress (`>= 500 BRL`), order/delivery notes (`maxLength = 200`), and multi-currency conversion (`useCurrency`).
