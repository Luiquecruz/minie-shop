# Custom Hooks Inventory (Incremental)

Tracks all custom React hooks under `apps/storefront/src/hooks/` (plus `useI18n` in `apps/storefront/src/i18n/`).

---

## Summary Table

| Hook | Path | Primary Responsibility | Dependencies |
| :--- | :--- | :--- | :--- |
| `useCart` (+ granular hooks) | `apps/storefront/src/hooks/useCart.ts` | Global & granular Redux cart hooks (`useCart`, `useCartActions`, `useCartBadge`, `useCartHasItems`, `useCartPageMeta`, `useCartItemIds`, `useRecentCartProductIds`, `useCartItemState`, `useCartPromoState`, `useCartShippingState`, `useCartShippingPricing`, `useCartOrderNoteState`, `useCartSummaryState`) + frozen `cartSlice` constant/helper re-exports | `store/hooks`, `cartSlice`, `cartSelectors` |
| `useCartQuoteSync` | `apps/storefront/src/hooks/useCartQuoteSync.ts` | Lazy + 5-min TTL server cart repricing (`POST /pricing/quote`) with snapshot & monotonicity guards | `@tanstack/react-query`, `queryKeys`, `useCartActions`, `useCurrency`, `useProductRepository` |
| `useCombobox` | `apps/storefront/src/hooks/useCombobox.ts` | Headless WAI-ARIA APG combobox state, keyboard navigation (`ArrowDown`/`Up`/`Home`/`End`/`Escape`), IME guard, and prop getters | React `useState`, `useRef`, `useId`, `useEffect` |
| `useCurrency` | `apps/storefront/src/hooks/useCurrency.ts` | Currency state (`BRL`/`USD`/`EUR`) and locale-aware integer-cents `Intl.NumberFormat` formatting (zero client FX) | `store/hooks`, `currencySlice`, `useI18n`, `utils/money` |
| `useDebounce<T>` | `apps/storefront/src/hooks/useDebounce.ts` | Generic value debouncing with timer cleanup | React `useState`, `useEffect` |
| `useDevChaos` | `apps/storefront/src/hooks/useDevChaos.ts` | DEV-only facade over `infrastructure/http/chaos` (`delayMs`, `fail`, toggles, reset) keeping components decoupled from `infrastructure/` | `infrastructure/http/chaos` |
| `useFavorites` | `apps/storefront/src/hooks/useFavorites.ts` | Favorites query (`useFavoritesQuery`), serialized optimistic toggle mutation (`useToggleFavoriteMutation`) with concurrency queue rollback, and facade | `@tanstack/react-query`, `queryKeys`, `useProductRepository` |
| `useI18n` | `apps/storefront/src/i18n/index.ts` | Reactive storefront i18n (`en` \| `pt-BR`), `<html lang>` sync & `minieshop_locale` persistence | `I18nProvider`, `i18nContext` |
| `useInView` | `apps/storefront/src/hooks/useInView.ts` | Latched `IntersectionObserver` hook (`rootMargin: '200px 0px'`) for viewport-triggered lazy loading | Browser `IntersectionObserver` |
| `useProductRepository` | `apps/storefront/src/hooks/useProductRepository.ts` | Retrieves injected `ProductRepository` implementation (`HttpProductRepository` or `MockProductRepository`) from React Context | `productRepositoryContext` |
| `useProductsQuery` (+ catalog hooks) | `apps/storefront/src/hooks/useProducts.ts` | `useProductsQuery` (`useInfiniteQuery` cursor pagination), `useCategoriesQuery`, `useFacetsQuery`, `useProductQuery`, `useStockValidationQuery`, `translateStockWarning` | `@tanstack/react-query`, `queryKeys`, `useCurrency`, `useProductRepository` |
| `useProductRecommendationsQuery` / `useCartCrossSellQuery` | `apps/storefront/src/hooks/useRecommendations.ts` | Single-request PDP `related`/`upsell` recommendations and Cart cross-sell (up to 20 recent IDs, 5-min `staleTime`, `keepPreviousData`) | `@tanstack/react-query`, `queryKeys`, `useCurrency`, `useProductRepository` |
| `useSearchSuggestQuery` / `useStorefrontSearchClient` | `apps/storefront/src/hooks/useSearch.ts` | Header autocomplete suggestions (`GET /search/suggest`, min 2 trimmed chars, max 8, 30s `staleTime`, `AbortSignal`) and React InstantSearch `SearchClient` hook | `@tanstack/react-query`, `queryKeys`, `useCurrency`, `useProductRepository`, `instantSearchAdapter` |
| `useTheme` | `apps/storefront/src/hooks/useTheme.ts` | Theme preference (`system` \| `light` \| `dark`) via `useSyncExternalStore`, `localStorage['minieshop_theme']`, `html[data-theme]` sync, and guarded live `matchMedia` listener | React `useSyncExternalStore`, `useEffect`, `useCallback` |

---

## Hook Details

### `useCart` & Granular Cart Hooks (`apps/storefront/src/hooks/useCart.ts`)
- **Purpose:** Encapsulates Redux `cart` memoized selectors (`src/store/selectors/cartSelectors.ts`) and stable dispatchers (`useCartActions`) so presentation components never call `useSelector`/`useDispatch` or import `store/slices/cartSlice` directly.
- **Granular Subscription Rule:** Add-only catalog surfaces (`ProductCard`, `ProductListingPage`, `ProductDetailPage`, `SearchResultsPage`) must call `useCartActions()` (zero cart state subscriptions), `Navbar` calls `useCartBadge()`, and `CartPage` subcomponents call their targeted slice hooks (`useCartItemIds`, `useCartItemState`, `useCartPromoState`, `useCartShippingState`, `useCartOrderNoteState`, `useCartSummaryState`, `useRecentCartProductIds`).
- **Frozen-Slice Re-Exports:** Re-exports `EMPTY_COUPON_ERROR`, `MAX_ORDER_NOTE_LENGTH`, `extractInvalidCouponCode`, `formatInvalidCouponError`, and `resolveMaxStock` for cart UI components without violating layer rules.

### `useTheme` (`apps/storefront/src/hooks/useTheme.ts`)
- **Returns:** `{ preference, resolvedTheme, setTheme, cycleTheme }`
- **Behavior:** Subscribes via `useSyncExternalStore` using a composite `${preference}:${resolvedTheme}` snapshot so live OS `prefers-color-scheme: dark` events trigger re-renders when `preference === 'system'` (and are safely ignored after explicit `'light'`/`'dark'` selection). Persists to `localStorage['minieshop_theme']` and updates `document.documentElement.dataset.theme` in lockstep with the inline anti-FOUC script in `index.html`.

### `useCurrency` (`apps/storefront/src/hooks/useCurrency.ts`)
- **Returns:** `{ currentCurrency, currencyConfig, setCurrency, formatPrice, supportedCurrencies }`
- **Behavior:** Formats integer-cents amounts using the active i18n locale (`formatCents`) without ever applying client-side FX multiplication.

### Catalog & Product Query Hooks (`apps/storefront/src/hooks/useProducts.ts`)
- `useProductsQuery(filters)`: `useInfiniteQuery` keyed by `queryKeys.products.list(currency, filters)` with `placeholderData: keepPreviousData` and `AbortSignal` forwarding.
- `useCategoriesQuery()`: Cached category tree (`staleTime: 5m`).
- `useFacetsQuery(filters)`: Disjunctive facets keyed by active currency and filters (`keepPreviousData`).
- `useProductQuery(slug)`: Single PDP lookup keyed by `currency` and `slug`.
- `useStockValidationQuery(slug, debouncedQuantity, enabled)`: Debounced availability validation (`staleTime: 30s`, `retry: 0`).

### Search & Recommendation Hooks (`useSearch.ts`, `useRecommendations.ts`)
- `useStorefrontSearchClient()`: Memoizes `createStorefrontSearchClient(repository, currentCurrency)` so `SearchResultsPage` never imports `infrastructure/search/*` directly.
- `useSearchSuggestQuery(debouncedQuery, enabled)`: Fires `GET /search/suggest` only when `enabled && trimmed.length >= 2`.
- `useProductRecommendationsQuery({ slug, types, enabled })`: Fetches `related` and `upsell` in one call once `useInView` latches.
- `useCartCrossSellQuery({ productIds, limit, enabled })`: Fetches cross-sell items for up to 20 recent distinct cart product IDs.

### Favorites Hooks (`apps/storefront/src/hooks/useFavorites.ts`)
- `useFavoritesQuery()`: Reads server-backed favorite IDs under `queryKeys.favorites.all`.
- `useToggleFavoriteMutation()`: Serializes mutations under `scope: { id: 'favorites' }`, tracks pending toggles in a per-`QueryClient` `WeakMap` to project optimistic state safely over rapid clicks, rolls back cleanly on error, and invalidates only once the queue drains.
