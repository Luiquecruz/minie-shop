---
trigger: always_on
description: "Architectural boundaries, state management, routing, data access, and incremental ADR/SDD governance."
---

# Architecture Rules

## 1. Layering & Directory Responsibilities
- `src/layouts/`: Shared route shells (`RootLayout`) rendering `<Outlet />` and persistent chrome (`Navbar`, footer, `MiniCart`).
- `src/pages/`: Route-level container components (`ProductListingPage`, `ProductDetailPage`) that orchestrate data fetching, SEO `<Helmet>` tags, and page layout.
- `src/components/`: Self-contained reusable UI units (`Dropdown`, `MiniCart`, `Navbar`, `PriceBox`, `ProductCard`, `SearchBar`), each in its own `PascalCase/` folder with colocated `.jsx` and `.css`.
- `src/hooks/`: Custom React hooks (`useCart`, `useCurrency`, `useFetch`) encapsulating Redux dispatch/selectors and async lifecycle management.
- `src/store/`: Redux Toolkit `configureStore` (`src/store/index.js`) and domain slices (`src/store/slices/*`).
- `src/services/`: Data access boundary (`src/services/api.ts`). Components and pages must fetch catalog/stock data through `productsApi`, never importing `src/data/products.ts` directly into UI components.
- `src/types/`: Centralized domain entities, API contracts, and async state discriminated unions (`currency.ts`, `product.ts`, `cart.ts`, `api.ts`, `index.ts`).
- `src/utils/`: Pure, framework-agnostic business logic (`currency.ts`, `price.ts`) with zero React or Redux dependencies.
- `src/data/`: Mock dataset (`products.ts`) enriched at module load via `calculatePrice`.

## 2. Routing & SEO Architecture
- Use `BrowserRouter` with declarative `<Routes>` and `<Route>` inside `src/App.tsx`.
- Wrap the application in `<HelmetProvider>` and define route-specific `<Helmet>` `<title>` and `<meta name="description">` inside page components.
- Preserve the fallback route (`*`) and canonical `RootLayout` wrapper unless an ADR updates the routing topology.

## 3. State Management Boundaries
- **Global Redux State (`cart`, `currency`):** Use Redux Toolkit slices only for cross-cutting, persistent, or multi-view state. Persist slice state safely via `localStorage` wrapped in `try/catch` with `typeof window !== 'undefined'` guards.
- **Component Access via Hooks:** UI components must consume global state through `useCart()` and `useCurrency()` rather than calling `useSelector`/`useDispatch` directly.
- **Local & Async State:** Keep ephemeral UI state (dropdown open/closed, active tab, search input text, loading/error banners) in component state (`useState`) or `useFetch`.

## 4. Async Cancellation & Pricing Precedence
- Every debounced or async search/validation flow must support `AbortController` / `AbortSignal` and clean up pending timers and requests on unmount or dependency change.
- Base catalog prices are stored in `BRL`. Always compute discount precedence (`special_price` < `regular_price`) through `calculatePrice()` in `src/utils/price.ts` and format/convert through `src/utils/currency.ts`.

## 5. Incremental Architecture Evolution (ADR & SDD)
- **ADR First:** Any architectural change (new runtime dependency, state library change, test framework adoption, backend integration, TypeScript configuration, or new routing layer) requires a new sequential ADR in `docs/adr/` (`NNNN-slug.md`) and an entry in `docs/adr/README.md`.
- **SDD Before Implementation:** Substantial features (such as Phase 6 Cart/Checkout) should start with a spec in `docs/sdd/` (`NNNN-slug.md`).
- **Incremental Docs Sync:** Whenever a feature, component, hook, slice, service method, or utility is added or changed, update the corresponding inventory under `docs/`.
