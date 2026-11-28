---
trigger: always_on
description: "Architectural boundaries, state management, routing, data access, and incremental ADR/SDD governance."
---

# Architecture Rules

## 1. Monorepo Boundaries & Package Ownership
- `packages/config/`: Shared TypeScript (`tsconfig.{base,node,web}.json`), ESLint (`eslint.base.mjs`), and Prettier (`prettier.json`) presets consumed by package name (`@minieshop/config/*`, never `../../`).
- `packages/contracts/`: Shared Zod v4 DTOs exposing strict server schemas (`.strict()`) and tolerant client schemas (`.strip()`). Backend-internal indexing documents must remain inside `apps/api`, never exported from `@minieshop/contracts`. Validate package exports with `pnpm --filter @minieshop/contracts lint:pkg` (`publint --strict`).
- `packages/email/`: React Email transactional templates (HTML + plain text) with unit tests and ESLint.
- `apps/api/`: Modular NestJS + Fastify monolith (`ADR-0002`, `ADR-0006`, `ADR-0012`). Each domain module (`catalog`, `media`, `inventory`, `search`, `recommendations`, `identity`, `platform`) owns its PostgreSQL schema and exposes only `index.ts`. Cross-module imports and cross-schema Drizzle table imports are blocked by `eslint-plugin-boundaries` in `apps/api/eslint.config.mjs`.
- `apps/storefront/`: React 19 + Vite 8 + Tailwind CSS v4 SPA enforcing strict unidirectional layer imports via `apps/storefront/.oxlintrc.json`:
  - `src/domain/`: Repository port (`ProductRepository.ts`) and framework-free domain error helpers (`errors.ts`). Must never import React or `infrastructure/`.
  - `src/infrastructure/`: `HttpClient` (CSRF bootstrap/retry, `AbortSignal`, timeout, DEV-only chaos), `HttpProductRepository`, `MockProductRepository`, `queryStrings.ts`, and `instantSearchAdapter.ts`.
  - `src/context/`: `ProductRepositoryProvider` and `productRepositoryContext` (concrete `HttpProductRepository` is instantiated in the composition root `src/main.tsx`).
  - `src/hooks/`: Domain facades (`useCart`, `useCartActions`, `useCurrency`, `useTheme`, `useFavorites`, `useProducts`, `useSearch`, `useRecommendations`, `useCombobox`, `useInView`, `useDevChaos`, `useDebounce`).
  - `src/store/`: Redux Toolkit `createAppStore` (`src/store/index.ts`), typed hooks (`src/store/hooks.ts`), pure slices (`cartSlice.ts` frozen, `currencySlice.ts`), memoized selectors (`src/store/selectors/`), and `createListenerMiddleware` persistence (`src/store/persistence/`).
  - `src/layouts/`: Shared route shell (`RootLayout`) rendering Skip Link, persistent `Navbar`, single `<main id="main-content">`, `<footer>`, `<MiniCart />`, and DEV-only `<ApiDebugFab />`.
  - `src/pages/`: Route containers (`ProductListingPage`, `ProductDetailPage`, lazy `SearchResultsPage`, `CartPage`, `NotFoundPage`) that never import `infrastructure/` or `store/slices/` directly.
  - `src/components/`: Reusable UI components styled exclusively with Tailwind CSS v4 semantic utilities and `cn()`.
  - `src/utils/`: Pure helpers (`cn.ts`, `currency.ts`, `money.ts`, `catalogUrlParams.ts`, `searchUrlParams.ts`).

## 2. Routing, Resilience & SEO Architecture
- Use `BrowserRouter` with declarative `<Routes>` and `<Route>` inside `apps/storefront/src/App.tsx`, keeping canonical `/:category/:slug` PDP routes, `/search`, `/cart`, legacy `/product/:id` redirects, and `*` fallback.
- Wrap routes and lazy `<Suspense><SearchResultsPage /></Suspense>` in `<ErrorBoundary>` with recoverable reset/retry UI.
- Keep a **single `<main id="main-content">` landmark** in `RootLayout`; inner pages must render `<div>` or `<section>` roots, never nested `<main>` tags.
- Wrap the application in `<HelmetProvider>` and define route-specific `<Helmet>` `<title>` and `<meta name="description">` inside page components.

## 3. State Management Boundaries
- **Server State (TanStack React Query):** Own all remote catalog, facets, PDP, search suggestions, recommendations, stock validation, favorites, and server pricing quotes via `src/query/` and domain query hooks.
- **Global Client State (`cart`, `currency`):** Keep Redux Toolkit slices 100% pure (zero `localStorage` side effects inside reducers). Persist state exclusively via RTK `createListenerMiddleware` (`cartStorage.ts`, `currencyStorage.ts`) with `typeof window !== 'undefined'` and `try/catch` guards.
- **Component Access via Granular Hooks:** Components must consume state via facade hooks (`useCartActions()` for add-only surfaces like cards/PLP/PDP/Search, granular `CartPage` hooks, `useCurrency()`, `useTheme()`) instead of calling `useSelector`/`useDispatch` or importing `store/slices/*` directly.
- **Frozen `cartSlice` Guardrail:** Do not modify `cartSlice` reducer business logic without an explicit SDD/ADR decision.

## 4. Async Cancellation, CSRF & Monetary Policy
- Every debounced or async fetch/search/validation flow must propagate `AbortSignal` and clean up pending timers on unmount or dependency change.
- State-changing storefront requests flow through `HttpClient`, which automatically bootstraps/caches `GET /auth/csrf` and attaches `x-csrf-token` with single-retry recovery on expired tokens.
- **Integer-Cents & Server-Authoritative Pricing (`ADR-0017`, `ADR-0018`):** All monetary math runs in integer cents. The storefront **never** performs client-side FX conversion; it requests `?currency=` from the API (`GET /products`, `GET /products/:slug`, `GET /search`, `POST /pricing/quote`, recommendations) and formats returned `MoneyDTO` values at the UI boundary via `formatMoney` / `useCurrency().formatPrice`.

## 5. Styling & Theme Activation (`ADR-0024`)
- `apps/storefront/src/index.css` is the single CSS entrypoint (Tailwind CSS v4 + `@tailwindcss/vite`, 2-tier `light-dark()` tokens exposed via `@theme inline`, `html[data-theme="light" | "dark"]`, and `Baseline 2024+` target). Do not reintroduce per-component legacy `.css` files or `@layer legacy` shims.

## 6. Incremental Architecture Evolution (ADR & SDD)
- **ADR First:** Any architectural change (new runtime dependency, state library change, test framework adoption, styling engine change, backend module boundary, or routing shift) requires a sequential ADR in `docs/adr/` (`NNNN-slug.md`) and an entry in `docs/adr/README.md`. Never rewrite immutable historical ADR bodies; update status headers only.
- **SDD Before Implementation:** Substantial features must start with a spec in `docs/sdd/` (`NNNN-slug.md`).
- **Incremental Docs Sync:** Whenever features, patterns, components, hooks, slices, repository methods, or utils change, update `docs/design-patterns.md` and the corresponding inventory under `docs/` in the same PR.
