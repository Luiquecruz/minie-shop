# Components, Layouts & Pages Inventory (Incremental)

Tracks all layout shells, route pages, and reusable components in `src/`.

---

## Summary Table

| Category | Name | Path | Phase |
| :--- | :--- | :--- | :--- |
| **Layout** | `RootLayout` | `src/layouts/RootLayout/RootLayout.jsx` | Phase 2 / 5 |
| **Page** | `ProductListingPage` | `src/pages/ProductListingPage/ProductListingPage.jsx` | Phase 3 |
| **Page** | `ProductDetailPage` | `src/pages/ProductDetailPage/ProductDetailPage.jsx` | Phase 4 |
| **Component** | `Dropdown` | `src/components/Dropdown/Dropdown.jsx` | Phase 3 |
| **Component** | `Navbar` | `src/components/Navbar/Navbar.jsx` | Phase 3 / 4 / 5 |
| **Component** | `PriceBox` | `src/components/PriceBox/PriceBox.jsx` | Phase 3 |
| **Component** | `ProductCard` | `src/components/ProductCard/ProductCard.jsx` | Phase 3 / 4 / 5 |
| **Component** | `SearchBar` | `src/components/SearchBar/SearchBar.jsx` | Phase 4 |
| **Component** | `MiniCart` | `src/components/MiniCart/MiniCart.jsx` | Phase 5 |

---

## Layouts

### `RootLayout` (`src/layouts/RootLayout/RootLayout.jsx`)
- **Purpose:** Canonical React Router Layout Route shell wrapping all pages.
- **Renders:** `.app-shell` containing `<Navbar />`, `<main className="app-content"><Outlet /></main>`, `<footer className="app-footer">` (copyright `Minie Shop`), and `<MiniCart />`.

---

## Pages

### `ProductListingPage` (`src/pages/ProductListingPage/ProductListingPage.jsx`)
- **Route:** `/` and `*`
- **Dependencies:** `Helmet`, `useCart`, `productsApi`, `ProductCard`, `Dropdown`.
- **Local State:** `products`, `categories`, `selectedCategory` (`'All'`), `sortBy` (`''`), `isLoading`, `error`, `retryCount`.
- **Behavior:** Loads categories on mount and products on filter/sort/retry change using an `ignore` cleanup flag against stale promise resolution.

### `ProductDetailPage` (`src/pages/ProductDetailPage/ProductDetailPage.jsx`)
- **Route:** `/product/:id`
- **Dependencies:** `useParams`, `Link`, `useNavigate`, `Helmet`, `useCart`, `productsApi`, `PriceBox`, `ProductCard`.
- **Local State:** `product`, `relatedProducts`, `activeTab` (`'description' | 'manufacturer' | 'specs'`), `isLoading`, `error`, `addedNotice`.
- **Behavior:** Smooth-scrolls to top on `:id` change, loads product and up to 4 related products, renders masonry gallery, 3 ARIA tabs, inline + floating CTA bars, and toast notifications.

---

## Reusable Components

### `Dropdown` (`src/components/Dropdown/Dropdown.jsx`)
- **Purpose:** Cross-browser styled replacement for native `<select>`.
- **Props:**
  - `options`: `Array<{ value: string|number, label: string }>` (default `[]`)
  - `value`: `string|number`
  - `onChange`: `(value) => void`
  - `placeholder`: `string` (default `'Select'`)
  - `size`: `'sm' | 'md' | 'lg'` (default `'md'`)
  - `align`: `'left' | 'right'` (default `'right'`)
  - `className`: `string` (default `''`)
  - `ariaLabel`: `string` (default `'Selector'`)
- **Behavior:** Uses `pointerdown` outside-click listener and `Escape` key dismissal; implements `aria-haspopup="listbox"` and `role="option"`.

### `Navbar` (`src/components/Navbar/Navbar.jsx`)
- **Purpose:** Top sticky navigation bar across all routes.
- **Dependencies:** `Link`, `useCurrency`, `useCart`, `Dropdown`, `SearchBar`.
- **Behavior:** Displays brand link (`/`), global `SearchBar`, multi-currency `Dropdown` (`BRL`, `USD`, `EUR`), and cart toggle button displaying live `cartCount`.

### `PriceBox` (`src/components/PriceBox/PriceBox.jsx`)
- **Purpose:** Standardized price and discount presentation connected to `useCurrency` and `calculatePrice`.
- **Props:**
  - `price`: `Object | number` (`{ regular_price, special_price, final_price, discount_percentage }`)
  - `size`: `'sm' | 'md' | 'lg'` (default `'md'`)
  - `className`: `string` (default `''`)
  - `currency`: `string` (optional override; defaults to Redux `currentCurrency`)

### `ProductCard` (`src/components/ProductCard/ProductCard.jsx`)
- **Purpose:** Catalog card used in PLP and PDP related products.
- **Props:**
  - `product`: Product object (returns `null` if falsy)
  - `onAddToCart`: `(product) => void` (optional override; falls back to `useCart().addToCart`)
- **Behavior:** Links image and title to `/product/${id}`, shows category and stock badge, star rating, description, `PriceBox`, and `Add to Cart` button.

### `SearchBar` (`src/components/SearchBar/SearchBar.jsx`)
- **Purpose:** Global autocomplete search widget in `Navbar`.
- **Internal Helpers:** `HighlightMatch` (escapes regex special chars and wraps matches in `<mark>`).
- **Props:** `placeholder` (default `'Search products by name or category...'`).
- **Dependencies:** `useNavigate`, `useFetch`, `productsApi.searchProducts`, `PriceBox`.
- **Behavior:** Implements ARIA `combobox`/`listbox`, `300ms` debounced fetching, skeleton loading rows, keyboard navigation (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`), clear button, and navigation to `/product/:id`.

### `MiniCart` (`src/components/MiniCart/MiniCart.jsx`)
- **Purpose:** Global slide-over shopping cart drawer.
- **Internal Subcomponent:** `CartItem` — manages per-item `300ms` debounced `productsApi.validateStock()` with `AbortController` cleanup, numeric input clamping (`1..maxStock`), increment/decrement buttons, stock warnings, and unit/line totals.
- **Dependencies:** `Link`, `useCart`, `useCurrency`, `productsApi.validateStock`.
- **Behavior:** Renders `null` when `!isOpen`; locks body scroll when open; supports `Escape` and overlay click to close; shows empty state, item list, subtotal/total, and placeholder notices for Checkout and View Full Cart.
