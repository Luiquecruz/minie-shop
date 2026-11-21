# Components, Layouts & Pages Inventory (Incremental)

Tracks all layout shells, route pages, and reusable components in `src/`.

---

## Summary Table

| Category | Name | Path | Phase |
| :--- | :--- | :--- | :--- |
| **Layout** | `RootLayout` | `src/layouts/RootLayout/RootLayout.tsx` | Phase 2 / 5 / Post-Phase 5 |
| **Page** | `ProductListingPage` | `src/pages/ProductListingPage/ProductListingPage.tsx` | Phase 3 / Post-Phase 5 |
| **Page** | `ProductDetailPage` | `src/pages/ProductDetailPage/ProductDetailPage.tsx` | Phase 4 / Post-Phase 5 |
| **Page** | `CartPage` | `src/pages/CartPage/CartPage.tsx` | Phase 6 (Inc. 1) |
| **Component** | `ApiDebugFab` | `src/components/ApiDebugFab/ApiDebugFab.tsx` | Post-Phase 5 |
| **Component** | `Dropdown` | `src/components/Dropdown/Dropdown.tsx` | Phase 3 / Pre-Phase 6 |
| **Component** | `Navbar` | `src/components/Navbar/Navbar.tsx` | Phase 3 / 4 / 5 |
| **Component** | `Pagination` | `src/components/Pagination/Pagination.tsx` | Post-Phase 5 |
| **Component** | `PriceBox` | `src/components/PriceBox/PriceBox.tsx` | Phase 3 |
| **Component** | `ProductCard` | `src/components/ProductCard/ProductCard.tsx` | Phase 3 / 4 / 5 / Post-Phase 5 |
| **Component** | `SearchBar` | `src/components/SearchBar/SearchBar.tsx` | Phase 4 / Post-Phase 5 |
| **Component** | `MiniCart` | `src/components/MiniCart/MiniCart.tsx` | Phase 5 / Post-Phase 5 |

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
- **Behavior:** Migrated in Increment 2 from monolithic Context to pure functional Redux Toolkit `cartSlice` + memoized `createSelector` + `React.memo`, isolating re-renders strictly to affected sections. Handles quantity clamping, debounced stock checks, promo codes (`MINIE10`, `MINIE20`, `FREESHIP`), shipping selection, order notes, empty state, and currency conversion.

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
- **Dependencies:** `Link`, `useCurrency`, `useCart`, `Dropdown<CurrencyCode>`, `SearchBar`.
- **Behavior:** Displays brand link (`/`), global `SearchBar`, multi-currency `Dropdown` (`BRL`, `USD`, `EUR`), and cart toggle button displaying live `cartCount`.

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

### `SearchBar` (`src/components/SearchBar/SearchBar.tsx`)
- **Purpose:** Global autocomplete search widget in `Navbar`.
- **Dependencies:** `useNavigate`, `useDebounce`, `useProductSearchQuery`, `PriceBox`.
- **Behavior:** Implements ARIA `combobox`/`listbox`, `300ms` debounced React Query search with 1-minute cache, inline error + `"Try Again"` retry inside dropdown, skeleton loading rows, keyboard navigation for visible suggestions, match highlighting (`<mark>`), clear button, and navigation to `/product/:id`.

### `MiniCart` (`src/components/MiniCart/MiniCart.tsx`)
- **Purpose:** Global slide-over shopping cart drawer.
- **Internal Subcomponent:** `CartItem` (`CartItemProps`) — manages per-item `300ms` debounced `useStockValidationQuery` via `useDebounce`, numeric input clamping (`1..maxStock`), increment/decrement buttons, stock warnings for the current quantity, and unit/line totals.
- **Dependencies:** `Link`, `useCart`, `useCurrency`, `useDebounce`, `useStockValidationQuery`.
- **Behavior:** Renders `null` when `!isOpen`; locks body scroll when open; supports `Escape` and overlay click to close; shows empty state, item list, subtotal/total, navigates to `/cart` on **View Full Cart**, and shows placeholder notice for **Proceed to Checkout**.
