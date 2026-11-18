# Components, Layouts & Pages Inventory (Incremental)

Tracks all layout shells, route pages, and reusable components in `src/`.

---

## Summary Table

| Category | Name | Path | Phase |
| :--- | :--- | :--- | :--- |
| **Layout** | `RootLayout` | `src/layouts/RootLayout/RootLayout.tsx` | Phase 2 / 5 |
| **Page** | `ProductListingPage` | `src/pages/ProductListingPage/ProductListingPage.tsx` | Phase 3 / Pre-Phase 6 |
| **Page** | `ProductDetailPage` | `src/pages/ProductDetailPage/ProductDetailPage.tsx` | Phase 4 / Pre-Phase 6 |
| **Component** | `Dropdown` | `src/components/Dropdown/Dropdown.tsx` | Phase 3 / Pre-Phase 6 |
| **Component** | `Navbar` | `src/components/Navbar/Navbar.tsx` | Phase 3 / 4 / 5 |
| **Component** | `PriceBox` | `src/components/PriceBox/PriceBox.tsx` | Phase 3 |
| **Component** | `ProductCard` | `src/components/ProductCard/ProductCard.tsx` | Phase 3 / 4 / 5 |
| **Component** | `SearchBar` | `src/components/SearchBar/SearchBar.tsx` | Phase 4 |
| **Component** | `MiniCart` | `src/components/MiniCart/MiniCart.tsx` | Phase 5 |

---

## Layouts

### `RootLayout` (`src/layouts/RootLayout/RootLayout.tsx`)
- **Purpose:** Canonical React Router Layout Route shell wrapping all pages.
- **Renders:** `.app-shell` containing `<Navbar />`, `<main className="app-content"><Outlet /></main>`, `<footer className="app-footer">` (copyright `Minie Shop`), and `<MiniCart />`.

---

## Pages

### `ProductListingPage` (`src/pages/ProductListingPage/ProductListingPage.tsx`)
- **Route:** `/` and `*`
- **Dependencies:** `Helmet`, `useCart`, `productsApi`, `ProductCard`, `Dropdown<ProductSortOption>`.
- **Local State:** `fetchState` (`AsyncRequestState<Product[]>`), `categories` (`string[]`), `selectedCategory` (`string`), `sortBy` (`ProductSortOption`), `retryCount` (`number`).
<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:26347ed956f9acdb3ab0d02a5ff733a800d4732360440457b65dd8e9e31bbc3c -->

- **Behavior:** Loads categories on mount and products on filter/sort/retry change using an `ignore` cleanup flag against stale promise resolution. Selecting the current category or sort value leaves the request state unchanged.

<!-- /coderabbit-ai-generated:v1 -->

### `ProductDetailPage` (`src/pages/ProductDetailPage/ProductDetailPage.tsx`)
- **Route:** `/product/:id`
- **Dependencies:** `useParams<{ id: string }>`, `Link`, `useNavigate`, `Helmet`, `useCart`, `productsApi`, `PriceBox`, `ProductCard`.
- **Local State:** `productState` (`AsyncRequestState<Product>`), `relatedProducts` (`Product[]`), `activeTab` (`DetailTab`: `'description' | 'manufacturer' | 'specs'`), `addedNotice` (`string`).
- **Behavior:** Guards missing `id` during render, smooth-scrolls to top on `:id` change, loads product and up to 4 related products, renders masonry gallery, 3 ARIA tabs, inline + floating CTA bars, and toast notifications.

---

## Reusable Components

### `Dropdown` (`src/components/Dropdown/Dropdown.tsx`)
- **Purpose:** Generic cross-browser styled replacement for native `<select>`.
- **Exported Interfaces:** `DropdownOption<T extends string | number = string>`, `DropdownProps<T extends string | number = string>`
  - `options?: DropdownOption<T>[]` (default `[]`)
  - `value: T`
  - `onChange?: (value: T) => void`
  - `placeholder?: string` (default `'Select'`)
  - `size?: 'sm' | 'md' | 'lg'` (default `'md'`)
  - `align?: 'left' | 'right'` (default `'right'`)
  - `className?: string` (default `''`)
  - `ariaLabel?: string` (default `'Selector'`)
- **Behavior:** Uses typed `pointerdown` outside-click listener (`event.target instanceof Node`) and `React.KeyboardEvent<HTMLDivElement>` `Escape` dismissal; implements `aria-haspopup="listbox"` and `role="option"`.

### `Navbar` (`src/components/Navbar/Navbar.tsx`)
- **Purpose:** Top sticky navigation bar across all routes.
- **Dependencies:** `Link`, `useCurrency`, `useCart`, `Dropdown<CurrencyCode>`, `SearchBar`.
- **Behavior:** Displays brand link (`/`), global `SearchBar`, multi-currency `Dropdown` (`BRL`, `USD`, `EUR`), and cart toggle button displaying live `cartCount`.

### `PriceBox` (`src/components/PriceBox/PriceBox.tsx`)
- **Purpose:** Standardized price and discount presentation connected to `useCurrency` and `calculatePrice`.
- **Exported Interface (`PriceBoxProps`):**
  - `price: CalculatedPrice | RawPriceInput | number`
  - `size?: 'sm' | 'md' | 'lg'` (default `'md'`)
  - `className?: string` (default `''`)
  - `currency?: CurrencyCode` (optional override; defaults to Redux `currentCurrency`)

### `ProductCard` (`src/components/ProductCard/ProductCard.tsx`)
- **Purpose:** Catalog card used in PLP and PDP related products.
- **Exported Interface (`ProductCardProps`):**
  - `product: Product | null | undefined` (returns `null` if falsy)
  - `onAddToCart?: (product: Product) => void` (optional override; falls back to `useCart().addToCart`)
- **Behavior:** Links image and title to `/product/${id}`, shows category and stock badge, star rating, description, `PriceBox`, and `Add to Cart` button.

### `SearchBar` (`src/components/SearchBar/SearchBar.tsx`)
- **Purpose:** Global autocomplete search widget in `Navbar`.
- **Internal Helpers:** `HighlightMatch` (`HighlightMatchProps`) — escapes regex special chars and wraps matches in `<mark>`.
- **Exported Interface (`SearchBarProps`):** `placeholder?: string` (default `'Search products by name or category...'`).
- **Dependencies:** `useNavigate`, `useFetch<Product[]>`, `productsApi.searchProducts`, `PriceBox`.
- **Behavior:** Implements ARIA `combobox`/`listbox`, `300ms` debounced fetching, skeleton loading rows, keyboard navigation (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`), clear button, and navigation to `/product/:id`.

### `MiniCart` (`src/components/MiniCart/MiniCart.tsx`)
- **Purpose:** Global slide-over shopping cart drawer.
- **Internal Subcomponent:** `CartItem` (`CartItemProps`) — manages per-item `300ms` debounced `productsApi.validateStock()` with `AbortController` cleanup, numeric input clamping (`1..maxStock`), increment/decrement buttons, stock warnings, and unit/line totals.
- **Dependencies:** `Link`, `useCart`, `useCurrency`, `productsApi.validateStock`.
- **Behavior:** Renders `null` when `!isOpen`; locks body scroll when open; supports `Escape` and overlay click to close; shows empty state, item list, subtotal/total, and placeholder notices for Checkout and View Full Cart.
