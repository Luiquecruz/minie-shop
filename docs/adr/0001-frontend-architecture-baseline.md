# ADR-0001: Frontend Architecture Baseline (Phases 1–6 Inc. 2)

- **Status:** Partially Superseded by [ADR-0016](./0016-monorepo-pnpm-workspaces-turborepo.md), [ADR-0017](./0017-camada-dados-storefront-repositorio-cursor-rotas.md), [ADR-0018](./0018-multicurrency-pricing-and-storefront-i18n.md), and [ADR-0024](./0024-tailwind-v4-semantic-tokens-and-theme-activation.md) *(monorepo relocation, live API repository + cursor pagination, server-side currency pricing, and Tailwind CSS v4 semantic tokens)*
- **Date:** 2026-11-21
- **Phase:** Phases 1–6 (Increment 2)
- **Consolidates:** Former incremental ADRs `0001`–`0010` (pre-backend frontend milestones, preserved in Git history)
- **Related SDDs:** [`SDD-0001`](../sdd/0001-dedicated-cart-and-checkout.md), [`SDD-0003`](../sdd/0003-incremental-typescript-migration.md), [`SDD-0004`](../sdd/0004-tanstack-react-query-migration.md)

## Context
Through Phases 1–6 (Increment 2), **Progressive Minie Shop** evolved as a frontend-only e-commerce application to establish core React, TypeScript, routing, state management, caching, styling, and testing patterns. Ahead of introducing a backend architecture—which will reshape data persistence, API boundaries, and checkout workflows—the ten incremental frontend ADRs (`0001`–`0010`, including superseded intermediate steps such as the JS/JSX baseline, custom `useFetch`, and the monolithic `CartPageContext` + `useReducer` benchmark) are synthesized here into a single baseline record.

## Decision

### 1. Build Tooling, Language & Linting
- **Vite `^8.3.4`** (`@vitejs/plugin-react`, dev server on port `5199`, `host: true`) + **React `^19.3.1`**.
- **Strict TypeScript (`^7.0.2`):** `"strict": true`, `"allowJs": false`, `"moduleResolution": "bundler"`, `"noEmit": true`, extensionless relative imports, and a **zero-`any` policy** (domain contracts in `src/types/`, co-located component prop interfaces, `unknown` narrowing in `catch` and `localStorage` guards).
- **Oxlint (`^1.88.0`):** Configured in `.oxlintrc.json` with `react`, `oxc`, and `typescript` plugins (`typescript/no-explicit-any: "error"`). Production builds are gated by `tsc --noEmit && vite build`.

### 2. Routing & SEO
- **`react-router-dom` `^7.18.4`** using declarative `<BrowserRouter>`, `<Routes>`, and `<Route>` in `src/App.tsx`.
- Canonical **Layout Route** (`src/layouts/RootLayout/`) rendering persistent `<Navbar />`, `<main><Outlet /></main>`, `<footer>`, and `<MiniCart />` across `/`, `/product/:id`, `/cart`, and fallback `*`.
- **`react-helmet-async` `^3.0.0`** (`<HelmetProvider>` + per-page `<Helmet>`) for dynamic `<title>` and `<meta name="description">`.

### 3. Global Client State (Redux Toolkit)
- **`@reduxjs/toolkit` `^2.13.0`** + **`react-redux` `^9.3.0`** strictly for synchronous, cross-view, persistent client state, accessed via typed hooks (`src/store/hooks.ts`) and facade hooks (`src/hooks/useCart.ts`, `src/hooks/useCurrency.ts`):
  - **`currencySlice`:** Manages `BRL`, `USD`, `EUR` selection persisted to `localStorage` (`minieshop_currency`). Base catalog prices are stored in `BRL`, computed via `calculatePrice()` (`src/utils/price.ts`), and converted/formatted via `src/utils/currency.ts`.
  - **`cartSlice`:** Owns `items`, `isOpen`, `stockWarnings`, `couponInput`, `appliedCoupon`, `couponError`, `shippingMethod`, and `orderNote` with pure immutable reducers (structural sharing, `1..stock` guardrails).
- **Decoupled Persistence & Memoization:** `localStorage` hydration/writes (`minieshop_cart`, `minieshop_cart_prefs`) run outside reducers via `src/store/persistence/cartStorage.ts` and RTK `createListenerMiddleware`. Derived cart totals and lookups use `createSelector` (`src/store/selectors/cartSelectors.ts`), granular hooks, and `React.memo` on `CartPage` subcomponents (reducing measured React `<Profiler>` updates by 77.1% compared to the earlier monolithic Context + `useReducer` baseline).

### 4. Server / Async Data State (TanStack React Query & Simulated API)
- **`@tanstack/react-query` `^5.x`** (plus dev-only Devtools) manages all asynchronous server-like state via a singleton `QueryClient` (`src/query/queryClient.ts`):
  - `staleTime`: 2m (catalog, PDP, related, favorites), 5m (categories), 1m (search autocomplete), 30s (stock validation); `gcTime`: 10m; `refetchOnWindowFocus: false`.
  - Smart retry skipping `ProductNotFoundError` and retrying transient failures up to 2 times with capped exponential backoff.
  - Typed query key factory (`src/query/queryKeys.ts`), `keepPreviousData` URL-synced pagination (`?page=&category=&sort=`), and optimistic Favorites mutations with automatic rollback.
- **Data Boundary (`src/services/api.ts`):** All UI components fetch through `productsApi` (supporting `AbortSignal`) rather than importing `src/data/products.ts` directly. Includes `apiErrorSimulator` + `ApiDebugFab` for deterministic error/retry verification.

### 5. Design System, Dark Mode & UI Policy
- Design tokens defined as CSS custom properties in `src/index.css` (`--container-max-width: 1280px`), supporting `@media (prefers-color-scheme: dark)` and explicit `[data-theme="dark"]` / `html.dark` overrides.
- Colocated BEM stylesheets per component, custom accessible primitives (`Dropdown<T>`), and a strict **SVG-only icon policy** (no Unicode emojis in UI).

### 6. Automated Testing
- **Vitest (`^5.1.1`)** + **React Testing Library** + **`@testing-library/user-event`** + **`@testing-library/jest-dom`** + **`jsdom`** (`vitest.config.ts`, `src/test/setup.ts`).
- Colocated `*.test.ts` / `*.test.tsx` suites verifying pure reducer immutability, `createSelector` memoization, and React `<Profiler>` render-isolation assertions (`npm test`).

## Consequences
### Positive
- Clean separation between client state (Redux Toolkit), async server cache (TanStack Query), pure business logic (`src/utils/`), and data boundary (`src/services/api.ts`).
- Strict compile-time safety (`tsc --noEmit`), fast linting (`oxlint`), and deterministic unit/profiler tests (`vitest run`).
- Zero CSS/UI framework lock-in with consistent light/dark theme tokens.

### Negative / Trade-offs
- Catalog, favorites, stock validation, and cart persistence are currently simulated client-side (`PRODUCTS_MOCK` + `localStorage`) with no real backend authority, authentication, or order persistence.

## Incremental Evolution Notes
This document serves as the consolidated frontend baseline prior to the backend journey. Subsequent architectural decisions—such as introducing a backend service/API, database, authentication, server-backed cart/checkout, or replacing `productsApi` mocks with real HTTP clients—will be recorded sequentially starting at **`ADR-0002`**, superseding only the affected sections of this baseline.
