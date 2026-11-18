# System Architecture

## 1. Overview
**Progressive Minie Shop** is a client-side React 19 single-page application bundled by Vite 8 and authored in strict TypeScript. It follows a layered frontend architecture where routing, layout chrome, global state, async data simulation, domain types, and pure business utilities are cleanly separated.

```mermaid
flowchart TD
    Main["src/main.tsx (StrictMode + Redux Provider)"] --> App["src/App.tsx (HelmetProvider + BrowserRouter)"]
    App --> Layout["RootLayout (Navbar + Outlet + Footer + MiniCart)"]
    Layout --> PLP["ProductListingPage (/)"]
    Layout --> PDP["ProductDetailPage (/product/:id)"]
    Navbar["Navbar (SearchBar + Currency Dropdown + Cart Trigger)"] --> Hooks
    PLP --> Hooks
    PDP --> Hooks
    MiniCart["MiniCart Drawer"] --> Hooks
    Hooks["Custom Hooks (useCart, useCurrency, useFetch<T>)"] --> Store["Redux Store (cartSlice, currencySlice, store/hooks.ts)"]
    Hooks --> API["Simulated API (src/services/api.ts)"]
    Store --> LS["window.localStorage (minieshop_cart, minieshop_currency)"]
    API --> Mock["Mock Catalog (src/data/products.ts)"]
    Mock --> PriceEngine["Price Engine (src/utils/price.ts)"]
    PriceBox["PriceBox / MiniCart"] --> CurrencyEngine["Currency Engine (src/utils/currency.ts)"]
    Types["Domain Types (src/types/*)"] -.-> PriceEngine
    Types -.-> CurrencyEngine
    Types -.-> API
    Types -.-> Store
    Types -.-> Hooks
```

---

## 2. Entry Points & Routing
- **`index.html`:** Declares `#root` mount container and loads `/src/main.tsx`.
- **`src/main.tsx`:** Verifies `#root` existence (`throw new Error` guard), mounts `<StrictMode>`, wraps `<App />` in Redux `<Provider store={store}>`, and imports global design tokens from `src/index.css`.
- **`src/App.tsx`:** Wraps routes in `<HelmetProvider>` and `<BrowserRouter>`. Uses React Router v7 canonical Layout Route pattern:
  - Parent `<Route element={<RootLayout />}>`
    - `index` (`/`) -> `ProductListingPage`
    - `path="product/:id"` -> `ProductDetailPage`
    - `path="*"` -> `ProductListingPage` (fallback)

---

## 3. Design System & Theming
Defined in `src/index.css` and `src/App.css`:
- **Color & Surface Tokens:** `--primary` (`#7c3aed` light / `#a855f7` dark), `--bg`, `--bg-secondary`, `--bg-tertiary`, `--card-bg`, `--card-subtle`, `--text`, `--text-heading`, `--text-muted`, `--border-color`, `--input-bg`, `--chip-bg`, `--nav-bg`.
- **Layout Tokens:** `--container-max-width: 1280px`, `--container-padding: 24px`, `--container-padding-mobile: 16px`.
- **Elevation & Typography:** `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-floating`, `--sans`, `--mono`.
- **Dark Mode Support:** Automatic `@media (prefers-color-scheme: dark)` when `:root:not([data-theme="light"])`, plus explicit `[data-theme="dark"]` and `html.dark` selectors.

---

## 4. Progressive Evolution Roadmap

| Phase | Scope | Status |
| :--- | :--- | :--- |
| **Phase 1** | Vite 8 + React 19 JS initialization + Oxlint baseline | Completed |
| **Phase 2** | Base routing (`BrowserRouter`), `HelmetProvider`, Redux `Provider` | Completed |
| **Phase 3** | PLP, `RootLayout`, `Navbar`, `Dropdown`, `PriceBox`, `ProductCard`, currency & pricing engines | Completed |
| **Phase 4** | PDP (`/product/:id`), dynamic `Helmet`, masonry gallery, 3-tab system, floating CTA, related products, `SearchBar` + `useFetch` | Completed |
| **Phase 5** | `MiniCart` slide-over drawer, debounced stock validation, `cartSlice` guardrails & `localStorage` persistence | Completed |
| **Pre-Phase 6** | Incremental TypeScript migration (`SDD-0003` / `ADR-0006`): strict mode, `src/types/`, generic `useFetch<T>`, discriminated unions | Completed |
| **Phase 6** | Dedicated Cart page & Checkout flow (authored directly in strict TypeScript) | Planned |
