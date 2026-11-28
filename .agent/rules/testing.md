---
trigger: model_decision
description: "Typechecking, linting, production build checks, Vitest/axe, Playwright metrics, security audit, and browser validation standards."
---

# Testing & Verification Rules

## 1. Mandatory Verification Gates
Every code change must pass the following workspace verification gates before requesting commit/push approval:

1. **Static Typechecking (`pnpm typecheck`):** Runs `turbo run typecheck` across all packages (`typescript 5.9.3` in Node packages, `7.0.2` in storefront). Must finish with `0 errors`.
2. **Static Linting (`pnpm lint`):** Runs ESLint (`apps/api` with `eslint-plugin-boundaries` + per-module DB schema rules, `packages/contracts`, `packages/email`) and Oxlint (`apps/storefront` with `react`, `jsx-a11y`, `oxc`, `typescript`, `import/no-cycle`, and layer-scoped `no-restricted-imports`). Must finish with `0 warnings and 0 errors`.
3. **Unit, Component & A11y Tests (`pnpm test`):** Runs contract tests (`@minieshop/contracts`), email renderer tests (`@minieshop/email`), API unit tests (`@minieshop/api`), and storefront Vitest + Testing Library + `vitest-axe` suites (`@minieshop/storefront`, including pages mounted inside `RootLayout` to catch landmark/heading regressions). Must finish with `0 failures`.
4. **Production Build (`pnpm build`):** Builds `@minieshop/contracts`, `@minieshop/email`, `@minieshop/api`, and `@minieshop/storefront` (`tsc --noEmit && vite build`).
5. **Security Audit (`pnpm audit --audit-level=high`):** Blocking gate requiring `0` high or critical advisories.
6. **Package Export Verification (when touching contracts):** `pnpm --filter @minieshop/contracts lint:pkg` (`publint --strict`).
7. **Backend Integration Suite (when touching API/schema/search/auth):** `pnpm --filter @minieshop/api test:integration` against Postgres + Meilisearch.
8. **Playwright Metrics & Visual QA (when touching storefront UI/perf/routing):** `pnpm --filter @minieshop/storefront metrics` against the live local API + storefront stack (`CLS`, lazy search bundle split, optimistic favorites, chaos recovery).
9. **CodeRabbit CLI Review:** Run `coderabbit review --agent --uncommitted --include-untracked` before opening/updating a PR and resolve all actionable findings.

## 2. Browser Flow Validation Checklist
When validating storefront UI flows (`pnpm dev:storefront` on `http://localhost:5199` + API on `http://localhost:3001`):
- **Theme & Anti-FOUC (`Navbar` + `index.html`):** Toggle `System / Light / Dark` (`html[data-theme]`), verify computed surface/text/skeleton contrast in both modes, and confirm hard reload in Dark mode applies `data-theme="dark"` synchronously with zero FOUC.
- **PLP (`/`):** Category/facet filters (`CatalogFilters`), sort `Dropdown` keyboard navigation (`ArrowUp`/`ArrowDown`/`Home`/`End`/`Escape`), cursor `Load More`, `keepPreviousData` smooth transitions, optimistic favorite toggle, and `Add to Cart`.
- **Header Search (`SearchBar`) & `/search`:** 200ms debounced APG combobox (`GET /search/suggest` with `categorySlug` navigation to `/:category/:slug`), Enter / "See all" navigation to lazy-loaded `/search?q=` (`react-instantsearch`), direct hard reload of `/search?q=fone`, and zero InstantSearch code in the main bundle.
- **Multi-Currency & i18n (`Navbar` + `PriceBox` + `MiniCart` + `CartPage`):** Switching `EN` / `PT-BR` and `BRL` / `USD` / `EUR` triggers server repricing (`?currency=` / `POST /pricing/quote`) with zero client FX math and persists across reloads.
- **PDP (`/:category/:slug`):** Dynamic `<title>`, breadcrumbs, gallery, APG keyboard-accessible `Tabs`, full-width `PdpRecommendationsSection` below the 2-column grid with `IntersectionObserver` lazy fetch and `CLS = 0`, and floating action bar.
- **MiniCart & CartPage (`/cart`):** Native `<dialog>.showModal()` right-aligned drawer with backdrop click, `Escape`, focus restoration, debounced stock validation, promo codes, shipping selector, order note, and inline `CartCrossSellSection` adds that keep `MiniCart` closed.
- **Landmarks, 404 & Responsive Quality:** Single `<main id="main-content">` + Skip Link, clean 404 page, zero console/page errors, zero emojis, and zero horizontal overflow across Desktop (`1440×900`), Tablet (`768×1024`), and Mobile (`390×844`).

## 3. Test Hygiene Standards
- Isolate `localStorage`, theme attributes (`document.documentElement.dataset.theme`), and fake timers between tests.
- Keep `MockProductRepository` contract-aligned with `HttpProductRepository` via `productRepositoryContract.test.ts`.
- Avoid running heavy browser/Playwright checks for purely documentation-only changes (`docs/`, `AGENTS.md`, `.agent/`).
