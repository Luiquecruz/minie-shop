# Features Inventory (Incremental)

Tracks all implemented user-facing features, their entry points, dependencies, and evolution phase across the monorepo.

---

## Summary Matrix

| ID | Feature | Phase | Primary Files | Status |
| :--- | :--- | :--- | :--- | :--- |
| `F-01` | Product Catalog, Disjunctive Facets & Cursor Pagination (PLP) | Phases 3, 6 & Pre-DS | `ProductListingPage.tsx`, `CatalogFilters.tsx`, `ProductCard.tsx`, `Dropdown.tsx`, `catalogUrlParams.ts` | Implemented |
| `F-02` | Server-Authoritative Pricing & Discount Presentation | Phases 3 & 6 | `PriceBox.tsx`, `utils/money.ts`, `apps/api` `CatalogService` | Implemented |
| `F-03` | Server-Side Multi-Currency Engine & Persistence | Phase 6.1 & Pre-DS | `pricing.service.ts`, `search.service.ts`, `currencySlice.ts`, `currencyStorage.ts`, `useCurrency.ts`, `useCartQuoteSync.ts`, `Navbar.tsx` | Implemented |
| `F-04` | Canonical Product Detail Page (PDP), APG Tabs & SEO | Phases 4, 6 & Pre-DS | `ProductDetailPage.tsx`, `useProducts.ts`, `legacyProductRedirects.ts`, `App.tsx` | Implemented |
| `F-05` | Header APG Autocomplete Combobox (`GET /search/suggest`) | Phase 7 (`S08.2`) & Pre-DS | `SearchBar.tsx`, `useCombobox.ts`, `useDebounce.ts`, `useSearch.ts` | Implemented |
| `F-06` | Native `<dialog>` Mini-Cart & Stock Guardrails | Phases 5, 6 & Pre-DS | `MiniCart.tsx`, `cartSlice.ts`, `useCart.ts`, `useProducts.ts` | Implemented |
| `F-07` | Stack-Pinned Strict TypeScript & Shared Contracts | Pre-Phase 6 & Pre-DS | `packages/config/*`, `packages/contracts/*`, `apps/*/tsconfig.json` | Implemented |
| `F-08` | TanStack Query Caching, Optimistic Favorites & DEV Chaos Controls | Phase 6 & Pre-DS | `src/query/*`, `useProducts.ts`, `useFavorites.ts`, `useDevChaos.ts`, `ApiDebugFab.tsx` | Implemented |
| `F-09` | Dedicated Cart Page (Pure Redux + Memoized Selectors) | Phase 6 (Inc. 2) & Pre-DS | `CartPage.tsx`, `cartSlice.ts`, `cartSelectors.ts`, `cartStorage.ts`, `useCart.ts` | Implemented |
| `F-10` | Checkout Flow & Order Confirmation | Post-Phase 8 | — | Planned |
| `F-11` | Storefront Internationalization (`en` + `pt-BR`) | Phase 6.1 | `src/i18n/*`, `Navbar.tsx`, `useCurrency.ts`, all storefront pages/components | Implemented |
| `F-12` | Lazy Search Results Route (`/search`) via React InstantSearch | Phase 7 (`S08.3`) & Pre-DS | `SearchResultsPage.tsx`, `instantSearchAdapter.ts`, `searchUrlParams.ts`, `ErrorBoundary.tsx` | Implemented |
| `F-13` | Lazy PDP Recommendations & Inline Cart Cross-Sell Carousels | Phase 7 (`R05`) & Pre-DS | `RecommendationCarousel.tsx`, `PdpRecommendationsSection.tsx`, `CartCrossSellSection.tsx`, `useRecommendations.ts`, `useInView.ts` | Implemented |
| `F-14` | Tailwind CSS v4, Semantic `light-dark()` Tokens & Theme Toggle | Pre-DS (`ADR-0024`) | `src/index.css`, `index.html`, `useTheme.ts`, `utils/cn.ts`, `Navbar.tsx` | Implemented |

---

## Feature Details

### F-01: Product Catalog, Disjunctive Facets & Cursor Pagination (PLP)
- **Route:** `/`
- **Capabilities:**
  - Cursor-paginated catalog (`useInfiniteQuery` with `PAGE_SIZE = 12` and "Load More") keeping prior cards visible during filter transitions (`keepPreviousData`) without flashing skeletons.
  - Synchronizes `?category=`, `?q=`, `?minPrice=`, `?maxPrice=`, `?inStock=`, `?sort=`, and `?attr.*` via Zod-validated `catalogUrlParams.ts`.
  - Disjunctive category, price, stock, and attribute facets (`CatalogFilters`) plus WAI-ARIA APG keyboard-navigable sort `Dropdown<ProductSort>`.
  - Initial skeleton grid, retryable error state, empty state with filter reset, optimistic favorite toggle, and `useCartActions().addToCart` without subscribing cards to full cart state.

### F-02 & F-03: Server-Authoritative Multi-Currency Pricing & Persistence
- **Capabilities:**
  - All monetary values travel and compute strictly in **integer cents** (`MoneyDTO` + `PriceDTO`); client-side FX conversion is forbidden (`ADR-0017`, `ADR-0018`).
  - Supports `BRL`, `USD`, and `EUR` across `GET /products`, `GET /products/:slug`, `GET /search?currency=`, recommendations, and `POST /pricing/quote`.
  - `currencySlice` is 100% pure; `currencyStorage.ts` hydrates initial currency in `createAppStore()` and persists updates via `createListenerMiddleware` under `minieshop_currency`.
  - `useCartQuoteSync` reprices open carts lazily with a 5-minute TTL and persists repriced `applyCartQuote` snapshots to `localStorage`.

### F-04: Canonical Product Detail Page (PDP), APG Tabs & SEO
- **Route:** `/:category/:slug` (with legacy `/product/:id` redirect support via `legacyProductRedirects.ts` and canonical category redirect)
- **Capabilities:**
  - Dynamic `<title>` and `<meta name="description">` via `react-helmet-async`.
  - Breadcrumbs, responsive image gallery (`ProductImage` with `srcset` and inline SVG fallback), optimistic `Save` / `Saved` favorite toggle, and WAI-ARIA APG keyboard-accessible `Description` / `Technical Specs` tabs (`ArrowLeft`/`ArrowRight`/`Home`/`End`, roving `tabIndex`).
  - Inline CTAs + sticky floating bottom action bar (`Add to Cart`, `Buy Now`) and full-width `PdpRecommendationsSection` cleanly below the 2-column desktop grid.

### F-05 & F-12: Header APG Autocomplete & Lazy Search Route (`/search`)
- **Locations:** Persistent `Navbar` (`SearchBar`) and lazy-loaded `/search` (`SearchResultsPage` wrapped in `<ErrorBoundary>` + `<Suspense>`).
- **Capabilities:**
  - `SearchBar` implements headless WAI-ARIA APG `useCombobox` backed by 200ms debounced `GET /search/suggest` (>= 2 trimmed chars, max 8 suggestions, `AbortSignal`), navigating directly via server-supplied `suggestion.categorySlug` to `/:category/:slug` or to `/search?q=`.
  - `/search` loads `react-instantsearch@7.55.1` in an isolated lazy chunk via `useStorefrontSearchClient()` (`hitsPerPage = 24`, `offset <= 200` cutoff notice, `?currency=` propagation, DEV-only mode/latency badge across `hybrid`, `keyword`, and `postgres` modes).

### F-06 & F-09: Native `<dialog>` Mini-Cart & Dedicated Cart Page (`/cart`)
- **Locations:** Global `MiniCart` inside `RootLayout` and dedicated `/cart` route (`CartPage`).
- **Capabilities:**
  - `MiniCart` uses native `<dialog>.showModal()` with right-aligned slide-in drawer, backdrop click, `Escape` dismissal, body scroll lock, focus restoration, and clean document landmarks.
  - Pure Redux `cartSlice` (frozen in Phase 7) + memoized `createSelector` (`cartSelectors.ts`) + `React.memo` subcomponents (`CartHeader`, `CartItemRow`, `CartPromoBox`, `CartShippingSelector`, `CartOrderNote`, `CartOrderSummary`) + versioned `v2` `localStorage` persistence via `createListenerMiddleware`.
  - Supports quantity clamping (`1..stock`), 300ms debounced stock validation (`useStockValidationQuery`), promo codes (`MINIE10`, `MINIE20`, `FREESHIP`), shipping method selection, free-shipping threshold indicator, and order notes (`maxLength = 200`).

### F-08: TanStack Query Caching, Optimistic Favorites & DEV Chaos Controls
- **Capabilities:**
  - Configured `QueryClient` (`staleTime`, `gcTime`, no retries on 4xx) and DEV-only `ReactQueryDevtools`.
  - `useFavorites` queues concurrent optimistic toggles per `QueryClient` with rollback on error and automatic `x-csrf-token` bootstrap/retry via `HttpClient`.
  - Lazy-loaded DEV-only `ApiDebugFab` backed by `useDevChaos()` injects `x-chaos-delay` and `x-chaos-fail` headers (tree-shaken out of production bundles).

### F-11: Storefront Internationalization (`en` + `pt-BR`)
- **Capabilities:**
  - Reactive `I18nProvider` (`en` and `pt-BR`), `<html lang>` synchronization, `minieshop_locale` persistence, and independent locale vs. currency selection in `Navbar`.

### F-13: Lazy PDP Recommendations & Inline Cart Cross-Sell Carousels
- **Capabilities:**
  - Reusable accessible `RecommendationCarousel` (`scroll-snap-type: x mandatory`, `prefers-reduced-motion`, boundary Prev/Next focus redirection, zero-CLS skeleton, explicit `showErrorDebug` prop, silent collapse on empty/error).
  - PDP loads `related` and `upsell` in one call once `IntersectionObserver` triggers (`rootMargin: '200px 0px'`, `CLS = 0`).
  - Cart fetches cross-sell for up to 20 recent distinct product IDs (`selectRecentCartProductIds`) and adds inline (`addToCart` + `closeCart`) without opening `MiniCart`.

### F-14: Tailwind CSS v4, Semantic `light-dark()` Tokens & Theme Toggle (`ADR-0024`)
- **Capabilities:**
  - Single CSS entrypoint (`apps/storefront/src/index.css`) with two-tier CSS-first tokens (`light-dark()` + `color-scheme: light dark`, exposed via `@theme inline`) and zero legacy component `.css` files (`-48%` raw production CSS).
  - Synchronous inline anti-FOUC script in `apps/storefront/index.html` sets `html[data-theme="light" | "dark"]` before first paint.
  - `useTheme()` (`system | light | dark`, `localStorage['minieshop_theme']`, live `prefers-color-scheme` listener) paired with an accessible 3-way inline-SVG segmented toggle in `Navbar`.
