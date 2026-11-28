# Components, Layouts & Pages Inventory (Incremental)

Tracks all layout shells, route pages, and reusable UI components under `apps/storefront/src/`. Every UI unit is styled exclusively with **Tailwind CSS v4** semantic utilities composed via `cn()` (`apps/storefront/src/index.css` is the sole CSS file in the storefront).

---

## Summary Table

| Category | Name | Path | Phase |
| :--- | :--- | :--- | :--- |
| **Layout** | `RootLayout` | `apps/storefront/src/layouts/RootLayout/RootLayout.tsx` | Phases 2, 5 & Pre-DS |
| **Page** | `ProductListingPage` | `apps/storefront/src/pages/ProductListingPage/ProductListingPage.tsx` | Phases 3, 6 & Pre-DS |
| **Page** | `ProductDetailPage` | `apps/storefront/src/pages/ProductDetailPage/ProductDetailPage.tsx` | Phases 4, 6, 7 & Pre-DS |
| **Page** | `SearchResultsPage` | `apps/storefront/src/pages/SearchResultsPage/SearchResultsPage.tsx` | Phase 7 (`S08.3`, lazy) & Pre-DS |
| **Page** | `CartPage` | `apps/storefront/src/pages/CartPage/CartPage.tsx` | Phases 6, 7 & Pre-DS |
| **Page** | `NotFoundPage` | `apps/storefront/src/pages/NotFoundPage/NotFoundPage.tsx` | Phase 6 & Pre-DS |
| **Component** | `ApiDebugFab` | `apps/storefront/src/components/ApiDebugFab/ApiDebugFab.tsx` | Phase 6 (DEV-only, lazy) & Pre-DS |
| **Component** | `AttributeIcon` | `apps/storefront/src/components/AttributeIcon/AttributeIcon.tsx` | Phase 6 |
| **Component** | `CartCrossSellSection` | `apps/storefront/src/pages/CartPage/components/CartCrossSellSection.tsx` | Phase 7 (`R05.3`) & Pre-DS |
| **Component** | `CatalogFilters` | `apps/storefront/src/components/CatalogFilters/CatalogFilters.tsx` | Phase 6 & Pre-DS |
| **Component** | `Dropdown` | `apps/storefront/src/components/Dropdown/Dropdown.tsx` | Phase 3 & Pre-DS (APG keyboard) |
| **Component** | `ErrorBoundary` | `apps/storefront/src/components/ErrorBoundary/ErrorBoundary.tsx` | Pre-DS |
| **Component** | `MiniCart` | `apps/storefront/src/components/MiniCart/MiniCart.tsx` | Phases 5, 6 & Pre-DS (`<dialog>`) |
| **Component** | `Navbar` | `apps/storefront/src/components/Navbar/Navbar.tsx` | Phases 3–7 & Pre-DS (Theme toggle) |
| **Component** | `PdpRecommendationsSection` | `apps/storefront/src/pages/ProductDetailPage/components/PdpRecommendationsSection.tsx` | Phase 7 (`R05.2`) & Pre-DS |
| **Component** | `PriceBox` | `apps/storefront/src/components/PriceBox/PriceBox.tsx` | Phases 3, 6 & Pre-DS |
| **Component** | `ProductCard` | `apps/storefront/src/components/ProductCard/ProductCard.tsx` | Phases 3–7 & Pre-DS |
| **Component** | `ProductImage` | `apps/storefront/src/components/ProductImage/ProductImage.tsx` | Phase 6 & Pre-DS |
| **Component** | `RecommendationCarousel` | `apps/storefront/src/components/RecommendationCarousel/RecommendationCarousel.tsx` | Phase 7 (`R05.4`) & Pre-DS |
| **Component** | `SearchBar` | `apps/storefront/src/components/SearchBar/SearchBar.tsx` | Phase 7 (`S08.2`) & Pre-DS |

---

## Layouts

### `RootLayout` (`apps/storefront/src/layouts/RootLayout/RootLayout.tsx`)
- **Purpose:** Canonical React Router Layout Route shell wrapping all storefront routes.
- **Renders:** Accessible Skip Link (`#main-content`), `<Navbar />`, the **single `<main id="main-content">` landmark** wrapping `<Outlet />`, `<footer>`, `<MiniCart />`, and DEV-only lazy `<ApiDebugFab />`.

---

## Pages

### `ProductListingPage` (`apps/storefront/src/pages/ProductListingPage/ProductListingPage.tsx`)
- **Route:** `/`
- **Dependencies:** `useSearchParams`, `Helmet`, `useCartActions`, `useFavoritesQuery`, `useCategoriesQuery`, `useFacetsQuery`, `useProductsQuery`, `CatalogFilters`, `ProductCard`, `Dropdown<ProductSort>`, `catalogUrlParams`.
- **Behavior:** Syncs catalog filters and sort in URL params via Zod; runs cursor pagination (`useInfiniteQuery`, `PAGE_SIZE = 12`) with `keepPreviousData`; announces updates via `sr-only` `role="status"` live region; displays retryable error state, skeleton cards, empty filter reset, and dismissible favorite error toast.

### `ProductDetailPage` (`apps/storefront/src/pages/ProductDetailPage/ProductDetailPage.tsx`)
- **Route:** `/:category/:slug` (canonicalizes mismatched `:category` segments via `<Navigate replace />`)
- **Dependencies:** `useParams`, `Link`, `Navigate`, `useNavigate`, `Helmet`, `isNotFoundError`, `useCartActions`, `useFavorites`, `useProductQuery`, `AttributeIcon`, `PriceBox`, `ProductImage`, `NotFoundPage`, `PdpRecommendationsSection`.
- **Behavior:** Smooth-scrolls to top on `:slug` change; renders breadcrumbs, gallery, optimistic `Save`/`Saved` toggle, `PriceBox`, assurance badges, WAI-ARIA APG keyboard-accessible `Description` and `Technical Specs` tabs (`ArrowLeft`/`ArrowRight`/`Home`/`End`), full-width `<PdpRecommendationsSection key={product.slug} />` cleanly below the 2-column desktop grid, and a sticky bottom floating action bar.

### `SearchResultsPage` (`apps/storefront/src/pages/SearchResultsPage/SearchResultsPage.tsx`)
- **Route:** `/search` (lazy-loaded chunk wrapped in `<ErrorBoundary>` + `<Suspense>` inside `App.tsx`)
- **Dependencies:** `react-instantsearch@7.55.1` (`InstantSearch`, `useSearchBox`, `useInfiniteHits`, `useInstantSearch`, `useConfigure`), `useStorefrontSearchClient`, `useCartActions`, `parseSearchUrlQuery`, `ProductCard`, `Helmet`.
- **Behavior:** Driven by `?q=` updated from `SearchBar`, skips API calls on empty queries, renders infinite pagination (`hitsPerPage = 24`) with `offset <= 200` cutoff message, announces counts via `aria-live="polite"`, and displays a DEV-only `mode` + latency badge.

### `CartPage` (`apps/storefront/src/pages/CartPage/CartPage.tsx`)
- **Route:** `/cart`
- **Subcomponents (`apps/storefront/src/pages/CartPage/components/`):** Memoized `CartHeader`, `CartItemRow`, `CartPromoBox`, `CartShippingSelector`, `CartOrderNote`, `CartOrderSummary`, and `CartCrossSellSection`.
- **Dependencies:** Granular Redux cart hooks (`src/hooks/useCart.ts`), `useCartQuoteSync`, `useCurrency`, `useDebounce`, `useStockValidationQuery`, `Helmet`.
- **Behavior:** Isolates re-renders strictly to affected cart sections; handles quantity clamping with visible inset `focus-visible` outlines, debounced stock validation, promo codes (`MINIE10`, `MINIE20`, `FREESHIP`), server-quoted shipping selection, order notes, empty state, and inline cross-sell adds.

### `NotFoundPage` (`apps/storefront/src/pages/NotFoundPage/NotFoundPage.tsx`)
- **Route:** `*` (and unknown product slugs)
- **Behavior:** Renders semantic `<div>` inside `RootLayout`'s `<main>`, sets 404 SEO metadata via `<Helmet>`, and provides recovery links back to `/` and `/search`.

---

## Reusable Components

### `ErrorBoundary` (`apps/storefront/src/components/ErrorBoundary/ErrorBoundary.tsx`)
- **Purpose:** Fault boundary wrapping `App` routes and lazy `<Suspense><SearchResultsPage /></Suspense>`.
- **Behavior:** Uses `getDerivedStateFromProps` with `resetKey` (location key) so healthy children never remount on navigation, displays an accessible `role="alert"` fallback with retry/reload recovery, and supports chunk-load retry.

### `ApiDebugFab` (`apps/storefront/src/components/ApiDebugFab/ApiDebugFab.tsx`)
- **Purpose:** Lazy-loaded DEV-only bottom-left floating control panel (`useDevChaos`) for toggling `chaos.delay` and `chaos.fail` and invalidating React Query cache.
- **Behavior:** Mobile-constrained popover width (`w-80 max-w-[calc(100vw-2.5rem)]`), focus management on open/Escape/close, and tree-shaken from production builds.

### `AttributeIcon` (`apps/storefront/src/components/AttributeIcon/AttributeIcon.tsx`)
- **Purpose:** Maps catalog attribute `iconKey` identifiers to crisp inline vector SVGs (`aria-hidden="true"`).

### `CatalogFilters` (`apps/storefront/src/components/CatalogFilters/CatalogFilters.tsx`)
- **Purpose:** Responsive sidebar/drawer filter panel rendering category tree, price bounds, in-stock toggle, and disjunctive attribute facets synchronized to URL search parameters.

### `Dropdown` (`apps/storefront/src/components/Dropdown/Dropdown.tsx`)
- **Purpose:** Generic accessible custom listbox selector (`DropdownProps<T extends string | number = string>`).
- **Behavior:** Full WAI-ARIA APG keyboard navigation (`ArrowDown`, `ArrowUp`, `Home`, `End`, `Enter`, `Space`, `Escape`), outside pointer dismissal, and trigger focus restoration.

### `Navbar` (`apps/storefront/src/components/Navbar/Navbar.tsx`)
- **Purpose:** Persistent sticky top navigation bar across all routes.
- **Dependencies:** `Link`, `useCartBadge`, `useCurrency`, `useTheme`, `useI18n`, `SearchBar`.
- **Behavior:** Displays brand link (`/`), global `SearchBar`, accessible 3-way `System / Light / Dark` inline-SVG theme toggle, independent language (`EN` / `PT-BR`) and currency (`BRL` / `USD` / `EUR`) selectors, and isolated cart badge toggle button.

### `PriceBox` (`apps/storefront/src/components/PriceBox/PriceBox.tsx`)
- **Purpose:** Standardized server-authoritative `PriceDTO` display (`PriceBoxProps`) formatting integer cents via `useCurrency().formatPrice`, rendering strikethrough regular price and discount badge when `hasDiscount` is true.

### `ProductCard` (`apps/storefront/src/components/ProductCard/ProductCard.tsx`)
- **Purpose:** Catalog, search, and recommendation card (`ProductCardProps`).
- **Behavior:** Uses `useCartActions()` (no subscription to full cart state), wraps image link and optimistic favorite toggle without nested interactive elements, displays category/stock badges, highlight chips, `PriceBox`, and `Add to Cart` button.

### `ProductImage` (`apps/storefront/src/components/ProductImage/ProductImage.tsx`)
- **Purpose:** Responsive `<picture>`/`<img>` renderer consuming `ImageDTO` (`srcset`, `sizes`, `aspectRatio`, blur placeholder, and inline SVG fallback per `ADR-0005`).

### `SearchBar` (`apps/storefront/src/components/SearchBar/SearchBar.tsx`)
- **Purpose:** Persistent global WAI-ARIA APG autocomplete combobox (`useCombobox` + `useSearchSuggestQuery`).
- **Behavior:** Queries `GET /search/suggest` after 200ms debounce (>= 2 trimmed chars, max 8 suggestions + "See all results"), navigates directly via `suggestion.categorySlug` to `/:category/:slug` or to `/search?q=`, and stays synced with `?q=` on `/search`.

### `RecommendationCarousel` (`apps/storefront/src/components/RecommendationCarousel/RecommendationCarousel.tsx`)
- **Purpose:** Reusable accessible horizontal product carousel (`R05.4`).
- **Behavior:** `section` (`aria-labelledby`, `aria-roledescription="carousel"`) with `ul`/`li` slides (`ProductCard`), CSS `scroll-snap-type: x mandatory`, `overscroll-behavior-x: contain`, `prefers-reduced-motion`, Prev/Next focus redirection, zero-CLS skeleton, explicit `showErrorDebug?: boolean` prop, and silent collapse on empty/error.

### `PdpRecommendationsSection` & `CartCrossSellSection`
- `PdpRecommendationsSection`: Keyed by `product.slug`, placed full-width below the 2-column PDP grid, triggers a single `GET /products/:slug/recommendations?types=related,upsell` request once `useInView({ rootMargin: '200px 0px' })` latches (`CLS = 0`).
- `CartCrossSellSection`: `React.memo` section below the Cart layout reading `useRecentCartProductIds()`, client-filtering cart items (`keepPreviousData`), and invoking `addToCart` + `closeCart` inline without opening `MiniCart`.

### `MiniCart` (`apps/storefront/src/components/MiniCart/MiniCart.tsx`)
- **Purpose:** Global right-aligned modal drawer rendered via native `<dialog>.showModal()`.
- **Behavior:** Renders `null` when closed, traps modal interaction cleanly without duplicating `banner`/`contentinfo` landmarks, locks body scroll, closes on `Escape` or backdrop mousedown, restores trigger focus on close, syncs server repricing via `useCartQuoteSync(isOpen)`, validates stock per item with 300ms debounce, and navigates to `/cart` on **View Full Cart**.
