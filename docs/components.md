# Components, Layouts & Pages Inventory (Incremental)

Tracks all layout shells, route pages, and reusable components in `src/`.

---

## Summary Table

| Category | Name | Path | Phase |
| :--- | :--- | :--- | :--- |
| **Layout** | `RootLayout` | `src/layouts/RootLayout/RootLayout.tsx` | Phase 2 / 5 / Post-Phase 5 |
| **Page** | `ProductListingPage` | `src/pages/ProductListingPage/ProductListingPage.tsx` | Phase 3 / Post-Phase 5 |
| **Page** | `ProductDetailPage` | `src/pages/ProductDetailPage/ProductDetailPage.tsx` | Phase 4 / 6 / 7 (`R05.2`) |
| **Page** | `SearchResultsPage` | `src/pages/SearchResultsPage/SearchResultsPage.tsx` | Phase 7 (`S08.3`, lazy) |
| **Page** | `CartPage` | `src/pages/CartPage/CartPage.tsx` | Phase 6 / 7 (`R05.3`) |
| **Component** | `ApiDebugFab` | `src/components/ApiDebugFab/ApiDebugFab.tsx` | Post-Phase 5 |
| **Component** | `CartCrossSellSection` | `src/pages/CartPage/components/CartCrossSellSection.tsx` | Phase 7 (`R05.3`) |
| **Component** | `CatalogFilters` | `src/components/CatalogFilters/CatalogFilters.tsx` | Phase 6 |
| **Component** | `Dropdown` | `src/components/Dropdown/Dropdown.tsx` | Phase 3 / Pre-Phase 6 |
| **Component** | `Navbar` | `src/components/Navbar/Navbar.tsx` | Phase 3 / 4 / 5 / 7 |
| **Component** | `Pagination` | `src/components/Pagination/Pagination.tsx` | Post-Phase 5 |
| **Component** | `PdpRecommendationsSection` | `src/pages/ProductDetailPage/components/PdpRecommendationsSection.tsx` | Phase 7 (`R05.2`) |
| **Component** | `PriceBox` | `src/components/PriceBox/PriceBox.tsx` | Phase 3 |
| **Component** | `ProductCard` | `src/components/ProductCard/ProductCard.tsx` | Phase 3 / 4 / 5 / 6 |
| **Component** | `ProductImage` | `src/components/ProductImage/ProductImage.tsx` | Phase 6 |
| **Component** | `RecommendationCarousel` | `src/components/RecommendationCarousel/RecommendationCarousel.tsx` | Phase 7 (`R05.4`) |
| **Component** | `SearchBar` | `src/components/SearchBar/SearchBar.tsx` | Phase 4 / 7 (`S08.2`) |
| **Component** | `MiniCart` | `src/components/MiniCart/MiniCart.tsx` | Phase 5 / 6 |

---

## Layouts

### `RootLayout` (`src/layouts/RootLayout/RootLayout.tsx`)
- **Purpose:** Canonical React Router Layout Route shell wrapping all pages.
- **Renders:** `.app-shell` containing `<Navbar />`, `<main className="app-content"><Outlet /></main>`, `<footer className="app-footer">` (copyright `Minie Shop`), `<MiniCart />`, and `<ApiDebugFab />`.

---

## Pages

### `ProductListingPage` (`src/pages/ProductListingPage/ProductListingPage.tsx`)
- **Route:** `/` and `*`
- **Dependencies:** `useSearchParams`, `Helmet`, `useCart`, `useFavoritesQuery`, `useCategoriesQuery`, `useProductsQuery`, `ProductCard`, `Dropdown<ProductSortOption>`, `Pagination`.
- **Behavior:** Syncs `category`, `sort`, and `page` (`PAGE_SIZE = 12`) in URL search params; includes `"Favorites"` filter chip with live count; keeps previous grid visible during page changes (`keepPreviousData`); clamps out-of-bounds pages using data for the current query; renders retryable error UI and displays card mutation errors in a dismissible toast.

### `ProductDetailPage` (`src/pages/ProductDetailPage/ProductDetailPage.tsx`)
- **Route:** `/product/:id`
- **Dependencies:** `useParams<{ id: string }>`, `Link`, `useNavigate`, `Helmet`, `useCart`, `useFavorites`, `useProductQuery`, `useRelatedProductsQuery`, `ProductNotFoundError`, `PriceBox`, `ProductCard`.
- **Behavior:** Smooth-scrolls to top on `:id` change, resets tab selection per `id`, loads product and dependent related products via React Query, includes optimistic `Save` / `Saved` heart button, distinguishes `ProductNotFoundError` from retryable transient errors, and renders masonry gallery, 3 ARIA tabs, inline + floating CTA bars, and toast notifications.

### `CartPage` (`src/pages/CartPage/CartPage.tsx`)
- **Route:** `/cart`
- **Subcomponents (`src/pages/CartPage/components/`):** Memoized `CartHeader`, `CartItemRow`, `CartPromoBox`, `CartShippingSelector`, `CartOrderNote`, `CartOrderSummary`.
- **Dependencies:** Granular Redux hooks (`src/hooks/useCart.ts`), `useCurrency`, `useDebounce`, `useStockValidationQuery`, `Helmet`.
<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:ff2486ae60f9219ab531356e2efa5e757468437b98be37547cc2d19d6eb7a9e1 -->

- **Behavior:** Migrated in Increment 2 from monolithic Context to pure functional Redux Toolkit `cartSlice` + memoized `createSelector` + `React.memo`, isolating re-renders strictly to affected sections. Handles quantity clamping, debounced stock checks, promo codes (`MINIE10`, `MINIE20`, `FREESHIP`), shipping selection, order notes, empty state, and currency conversion. Quantity edits accept decimal and exponent notation, truncate fractions, and validate only after the committed quantity has settled. The quantity field uses the same focus colors as the promo and note fields.

<!-- /coderabbit-ai-generated:v1 -->

---

## Reusable Components

### `ApiDebugFab` (`src/components/ApiDebugFab/ApiDebugFab.tsx`)
- **Purpose:** Discreet bottom-left floating debug simulator for testing React Query retries, error states, cache invalidation, and optimistic mutation rollbacks.
- **Dependencies:** `useMatch('/product/:id')`, `useQueryClient`, `apiErrorSimulator`.
- **Behavior:** Shifts upward (`api-debug-fab--pdp`) on PDP routes to avoid overlapping `.pdp-floating-bar`; focuses the close button on open, restores trigger focus on panel dismissal via the close button or Escape, and preserves outside click focus; toggles `failQueries` and `failFavoritesMutation` and triggers `queryClient.invalidateQueries()`.

### `Dropdown` (`src/components/Dropdown/Dropdown.tsx`)
- **Purpose:** Generic cross-browser styled replacement for native `<select>`.
- **Exported Interfaces:** `DropdownOption<T extends string | number = string>`, `DropdownProps<T extends string | number = string>`
- **Behavior:** Uses typed `pointerdown` outside-click listener and `Escape` dismissal; implements `aria-haspopup="listbox"` and `role="option"`.

### `Navbar` (`src/components/Navbar/Navbar.tsx`)
- **Purpose:** Top sticky navigation bar across all routes.
- **Dependencies:** `Link`, `useCurrency`, `useI18n`, `useCartBadge`, `SearchBar`.
- **Behavior:** Displays brand link (`/`), global `SearchBar`, independent language selector (`EN` / `PT-BR`) and currency selector (`BRL` / `USD` / `EUR`), and isolated cart badge toggle button displaying live `cartCount`.

### `Pagination` (`src/components/Pagination/Pagination.tsx`)
- **Purpose:** Numbered catalog pagination bar.
- **Exported Interface (`PaginationProps`):** `currentPage`, `totalPages`, `onPageChange`, `isFetching?`.
- **Behavior:** Renders `Previous`, numbered page buttons (`aria-current="page"`), `Next`, and an `Updating...` live status label during background transitions; returns `null` when `totalPages <= 1`.

### `PriceBox` (`src/components/PriceBox/PriceBox.tsx`)
- **Purpose:** Standardized price and discount presentation connected to `useCurrency` and `calculatePrice`.
- **Exported Interface (`PriceBoxProps`):** `price`, `size?`, `className?`, `currency?`.

### `ProductCard` (`src/components/ProductCard/ProductCard.tsx`)
- **Purpose:** Catalog card used in PLP and PDP related products.
- **Exported Interface (`ProductCardProps`):** `product`, `onAddToCart?`, `onFavoriteError?`.
- **Behavior:** Wraps image `<Link>` and optimistic favorite heart `<button>` in `.product-card__media` (avoiding nested interactive elements), shows category and stock badges, star rating, description, `PriceBox`, and `Add to Cart` button.

### `SearchResultsPage` (`src/pages/SearchResultsPage/SearchResultsPage.tsx`)
- **Route:** `/search` (lazy-loaded chunk via `React.lazy` in `App.tsx`)
- **Dependencies:** `react-instantsearch@7.55.1` (`InstantSearch`, `useSearchBox`, `useInfiniteHits`, `useInstantSearch`, `useConfigure`), `createStorefrontSearchClient`, `parseSearchUrlQuery`, `ProductCard`, `Helmet`.
- **Behavior:** Driven by `?q=` URL parameter updated from the persistent global `SearchBar`, skips API requests on empty queries, highlights the queried term with semantic `<strong>` (`1rem`, bold, no guillemets), renders infinite pagination (`hitsPerPage=24`) enforcing the `offset <= 200` cutoff notice, announces result counts via `aria-live="polite"`, and shows a DEV-only `mode` + response latency badge.

### `SearchBar` (`src/components/SearchBar/SearchBar.tsx`)
- **Purpose:** Global accessible WAI-ARIA APG autocomplete combobox persistent in `Navbar` across all routes (including `/search`, where it stays synced with `?q=`).
- **Dependencies:** `useNavigate`, `useLocation`, `useMatch`, `useQueryClient`, `useDebounce`, `useSearchSuggestQuery`, `useCombobox`, `parseSearchUrlQuery`.
- **Behavior:** Queries `/search/suggest` after ~200 ms debounce from >= 2 trimmed chars (max 8 suggestions + `"Ver todos os resultados para "` with semantic `<strong>`), handles `ArrowDown`/`ArrowUp`/`Home`/`End`/`Escape`/outside click while keeping DOM focus on `<input>`, announces counts via `aria-live="polite"`, navigates directly to `/:category/:slug` (or `/search?q=` on empty selection / `"See all"`), and preserves Enter submission when `suggest` fails.

### `RecommendationCarousel` (`src/components/RecommendationCarousel/RecommendationCarousel.tsx`)
- **Purpose:** Reusable accessible horizontal product carousel (`R05.4`).
- **Behavior:** Renders `section` (`aria-labelledby`, `aria-roledescription="carousel"`) with `ul`/`li` slides (`ProductCard`), CSS `scroll-snap-type: x mandatory`, `overscroll-behavior-x: contain`, `prefers-reduced-motion` support, boundary Prev/Next controls with focus redirection, horizontal-only `onFocusCapture` scroll-into-view, zero-CLS skeleton (`min-height: 600px`), and silent collapse on empty or error states (with DEV-only debug badge + `console.warn`).

### `PdpRecommendationsSection` & `CartCrossSellSection`
- `PdpRecommendationsSection` (`src/pages/ProductDetailPage/components/PdpRecommendationsSection.tsx`): Keyed by `product.slug`, reserves `690px` until settled, uses `useInView({ rootMargin: '200px 0px' })` to trigger a single `GET /products/:slug/recommendations?types=related,upsell` request once visible.
- `CartCrossSellSection` (`src/pages/CartPage/components/CartCrossSellSection.tsx`): `React.memo` section below `.cart-layout` reading `useRecentCartProductIds()`, client-filtering cart items (`keepPreviousData`), and adding inline via `addToCart` + `closeCart` without opening `MiniCart`.

### `MiniCart` (`src/components/MiniCart/MiniCart.tsx`)
- **Purpose:** Global slide-over shopping cart drawer.
- **Internal Subcomponent:** `CartItem` (`CartItemProps`) — manages per-item `300ms` debounced `useStockValidationQuery` via `useDebounce`, numeric input clamping (`1..maxStock`), increment/decrement buttons, stock warnings for the current quantity, and unit/line totals.
- **Dependencies:** `Link`, `useCart`, `useCurrency`, `useDebounce`, `useStockValidationQuery`.
- **Behavior:** Renders `null` when `!isOpen`; locks body scroll when open; supports `Escape` and overlay click to close; shows empty state, item list, subtotal/total, navigates to `/cart` on **View Full Cart**, and shows placeholder notice for **Proceed to Checkout**.
