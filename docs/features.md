# Features Inventory (Incremental)

Tracks all implemented user-facing features, their entry points, dependencies, and evolution phase.

---

## Summary Matrix

| ID | Feature | Phase | Primary Files | Status |
| :--- | :--- | :--- | :--- | :--- |
| `F-01` | Product Catalog & Filtering (PLP) | Phase 3 | `ProductListingPage.tsx`, `ProductCard.tsx`, `Dropdown.tsx` | Implemented |
| `F-02` | Pricing & Discount Precedence Engine | Phase 3 | `utils/price.ts`, `PriceBox.tsx` | Implemented |
| `F-03` | Multi-Currency Engine & Persistence | Phase 3 | `utils/currency.ts`, `currencySlice.ts`, `useCurrency.ts`, `Navbar.tsx` | Implemented |
| `F-04` | Product Detail Page (PDP) & SEO | Phase 4 | `ProductDetailPage.tsx`, `App.tsx` | Implemented |
| `F-05` | Global Autocomplete Search | Phase 4 | `SearchBar.tsx`, `useFetch.ts`, `api.ts` | Implemented |
| `F-06` | Floating Mini-Cart & Stock Guardrails | Phase 5 | `MiniCart.tsx`, `cartSlice.ts`, `useCart.ts`, `api.ts` | Implemented |
| `F-07` | Incremental TypeScript Migration | Pre-Phase 6 | `tsconfig.json`, `src/types/*`, `src/store/hooks.ts`, all `src/**/*.ts(x)` | Implemented |
| `F-08` | Dedicated Cart Page & Checkout Flow | Phase 6 | — | Planned |

---

## Feature Details

### F-01: Product Catalog & Filtering (PLP)
- **Route:** `/` (and fallback `*`)
- **Capabilities:**
  - Displays 30 mock catalog products fetched asynchronously via `productsApi.getProducts()`.
  - Dynamic category chip filters loaded via `productsApi.getCategories()` (`All` plus catalog categories).
  - Sorting via generic `Dropdown<ProductSortOption>` (`Default (Featured)`, `Lowest Price`, `Highest Price`, `Top Rated`, `Name (A - Z)`).
  - Discriminated union request state (`AsyncRequestState<Product[]>`), 8-card skeleton loading state, error alert with retry trigger, empty state with filter reset, and direct `Add to Cart` action.

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
  - Dynamic `<title>` and `<meta name="description">` via `react-helmet-async` (including "Product Not Found" state).
  - Breadcrumb navigation (`Catalog / <category> / <name>`).
  - Open masonry image gallery (4 aspect-ratio views per product) with mobile swipe hint.
  - 3 accessible tabs (`Description`, `Manufacturer`, `Technical Specs` key-value grid).
  - Inline action buttons + sticky floating bottom action bar (`Add to Cart`, `Buy Now`) with toast feedback.
  - Related products grid (`limit = 4`) fetched via `productsApi.getRelatedProducts()`.

### F-05: Global Autocomplete Search
- **Location:** `Navbar`
- **Capabilities:**
  - Uses generic `useFetch<Product[]>` (`debounceMs: 300`, `minQueryLength: 1`) backed by `productsApi.searchProducts({ query, limit: 6, signal, delayMs: 220 })`.
  - Cancels stale requests with `AbortController`.
  - ARIA combobox pattern with `ArrowUp`, `ArrowDown`, `Enter`, `Escape` keyboard support, click-outside dismissal, match highlighting (`<mark>`), skeleton loading, and direct route navigation to `/product/:id`.

### F-06: Floating Mini-Cart & Stock Guardrails
- **Location:** `RootLayout` (mounted globally)
- **Capabilities:**
  - Automatically opens when an item is added (`addToCart` sets `isOpen = true`).
  - Persists cart items under `localStorage` key `minieshop_cart` with runtime schema validation (`isValidCartItem`).
  - Enforces min (`1`) and max (`product.stock`) bounds in both Redux reducers and UI controls.
  - Performs debounced (`300ms`) async stock validation via `productsApi.validateStock()` with `AbortController` cleanup per cart item.
  - Locks `document.body.style.overflow` while open, closes on `Escape` or backdrop click, and displays placeholder feedback notices for `Proceed to Checkout` and `View Full Cart` until Phase 6.

### F-07: Incremental TypeScript Migration
- **Capabilities:**
  - Strict TypeScript (`"strict": true`, `"allowJs": false`, `"noUnusedLocals": true`, `"noUnusedParameters": true`, `"noFallthroughCasesInSwitch": true`) enforced via `npm run typecheck` and `npm run build`.
  - Zero explicit or implicit `any` enforced by Oxlint (`typescript/no-explicit-any: "error"`) and `tsconfig.json`.
  - Shared domain entities in `src/types/` (`currency.ts`, `product.ts`, `cart.ts`, `api.ts`) and co-located component prop interfaces.
