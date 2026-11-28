# ADR-0025: Design System Package Architecture, Native-First A11y & RSC Contract (`@minieshop/ui`)

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Engineering / Architecture (Phase 8 — Design System)
- **Related ADRs:** [`ADR-0016`](./0016-monorepo-pnpm-workspaces-turborepo.md), [`ADR-0020`](./0020-combobox-autocomplete-apg-proprio.md), [`ADR-0023`](./0023-monorepo-package-boundaries-stack-typescript-and-contracts.md), [`ADR-0024`](./0024-tailwind-v4-semantic-tokens-and-theme-activation.md)

---

## Context

Following the Pre-Design System baseline (`ADR-0023` package boundaries & stack-pinned TypeScript, `ADR-0024` Tailwind CSS v4 + 2-tier `light-dark()` tokens), `apps/storefront` had clean semantic styling and WAI-ARIA APG widgets (`useCombobox`, `Dropdown`, PDP `Tabs`, native `<dialog>` `MiniCart`), but all design tokens, `cn()`, and accessible primitives remained coupled inside `apps/storefront`.

Phase 8 (`SDD-0006`) extracts a reusable, standalone Design System (`@minieshop/ui`) capable of serving both the current Vite + React 19 storefront and future React Server Components (RSC) / Next.js consumers without bundling app-domain logic, duplicating CSS tokens, or introducing external headless UI framework lock-in.

## Decision

1. **Single Package Topology with Isolated React-Free `./tokens` Subpath (`D-01`):**
   - Introduce `packages/ui` (`@minieshop/ui`) inside the pnpm/Turborepo workspace rather than splitting `@minieshop/tokens` prematurely.
   - Declare `react` and `react-dom` strictly in `peerDependencies` (`>=19.0.0`) and `devDependencies` (never `dependencies`), keeping `clsx` and `tailwind-merge` as the only runtime dependencies.
   - Isolate `./tokens` (`packages/ui/src/tokens/*` and `packages/ui/src/utils/cn.ts`) as a strictly React-free subpath enforced by Oxlint `no-restricted-imports`, preserving an effortless extraction path if a non-React consumer or independent token release cadence arises later.
2. **Strict App- and Domain-Agnostic Boundary (`D-02`):**
   - Statically enforce via `packages/ui/.oxlintrc.json` that `@minieshop/ui` never imports `@minieshop/contracts`, `apps/*`, `react-router-dom`, `react-router`, `react-helmet-async`, `next/*`, Redux, TanStack Query, or `react-instantsearch`.
   - Keep domain composites (`ProductCard`, `PriceBox`, `CatalogFilters`, `SearchBar`, `MiniCart`, `Navbar`, recommendation sections) inside consumer apps (`apps/storefront`). All accessible labels in `@minieshop/ui` accept props with English defaults.
3. **Tailwind CSS v4 CSS-First Token Preset & `@source` Scanning (`D-03`, `D-04`):**
   - Move the `Baseline 2024+` 2-tier `light-dark()` tokens, `:root[data-theme="light" | "dark"]`, `@custom-variant dark`, `@theme inline`, keyframes, `.skeleton-shimmer`, and `.scrollbar-none` into `packages/ui/src/tokens/tokens.css` (zero global element resets).
   - Ship `packages/ui/src/tokens/styles.css` (`@import "./tokens.css";` + `@source "../";`) copied into `dist/tokens/` so consumer apps import `@minieshop/ui/styles.css` once and Tailwind CSS v4 automatically scans compiled `@minieshop/ui/dist` utilities into a single deduplicated stylesheet.
4. **Native-First HTML + In-House WAI-ARIA APG Composition (`D-05`):**
   - Prefer native HTML platform primitives (`<button>`, `<input>`, `<select>`, `<dialog>.showModal()`, `inert`) paired with in-house WAI-ARIA APG hooks (extending `ADR-0020`) rather than external headless libraries (`@radix-ui/react-*`, `@base-ui/react`, `react-aria`).
   - Expose Compound Components as RSC-safe named exports and dedicated subpath ESM namespaces (`import * as Dialog from '@minieshop/ui/dialog'`), avoiding `Object.assign` compound mutations on `"use client"` modules.
   - Expose polymorphism via an explicit `render` prop (element or render callback) instead of `asChild` (`React.cloneElement`) or generic `as={Component}` props for clean React 19 + TypeScript 7 inference.
5. **Strict SSR / RSC `"use client"` & Unbundled ESM Distribution Contract (`D-06`, `D-08`):**
   - Ban `import.meta.env` and render-time/module-top-level `window`/`document`/`localStorage` access across `packages/ui`.
   - Compile with native `tsc` (`typescript 7.0.2`) using `module: "NodeNext"` and `moduleResolution: "NodeNext"` (requiring explicit `.js` relative ESM extensions in `src/`) to emit unbundled ESM `.js` + `.d.ts` files into `dist/`, with `files: ["dist"]`, `sideEffects: ["**/*.css"]`, subpath `exports`, and `publint --strict` gating.
   - Preserve per-module `"use client"` directives 1:1 in `dist/` and verify in the build script that `dist/index.js` never emits a top-level `"use client"` directive so Server-safe primitives (`Button`, `Badge`, `Card`, `Skeleton`) remain importable in RSC environments.

## Consequences

### Positive
- Eliminates token and `cn()` duplication across apps while keeping `apps/storefront` production CSS identical and deduplicated in a single Tailwind v4 pass.
- Guarantees clean tree-shaking, zero React leakage in `./tokens`, and full forward compatibility with React Server Components / Next.js without extra bundler configuration.
- `publint --strict` and Oxlint boundary rules catch broken ESM subpath exports, missing `.js` extensions, or domain leakage at PR time.

### Trade-offs
- Relative imports inside `packages/ui/src/` must use explicit `.js` extensions to satisfy NodeNext unbundled ESM emission.
- Custom APG primitives require dedicated real-browser Playwright accessibility and visual regression testing (established in `ADR-0026`).
- Splitting `@minieshop/tokens` or extracting `@minieshop/commerce-ui` remains intentionally deferred until concrete multi-consumer triggers are met.
