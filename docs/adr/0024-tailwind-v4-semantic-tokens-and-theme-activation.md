# ADR-0024: Tailwind CSS v4, Two-Tier CSS-First Semantic Tokens & Theme Activation

- **Status:** Accepted
- **Date:** 2026-11-27
- **Deciders:** Engineering / Architecture Baseline (Phase 8 Pre-Design System)
- **Supersedes:** Legacy per-component hand-written CSS files in `apps/storefront` (originally introduced in Phases 1–7)

---

## Context

Prior to Phase 8 (Design System), `apps/storefront` maintained 18 hand-written CSS files with duplicated dark-mode blocks, hidden cross-route stylesheet dependencies (`/search` relying on `ProductListingPage.css`), four duplicated screen-reader-only helpers, non-adaptive light skeletons in dark mode, a desktop grid bug trapping `.pdp-recommendations` inside the left column of `.pdp-grid`, and no user-facing Light/Dark/System theme selector.

Entering Phase 8 (`@minieshop/ui`) with a dual CSS + Tailwind styling architecture or a `@layer legacy` bridge would create specificity conflicts, bloated bundles, and duplicated token maintenance.

## Decision

1. **Single Styling Engine — Tailwind CSS v4 (`@tailwindcss/vite`):**
   - Adopt Tailwind CSS v4 with `@tailwindcss/vite`, `clsx`, and `tailwind-merge` (`src/utils/cn.ts`) as the sole styling engine for `apps/storefront`.
   - Rewrite all legacy component, layout, and page stylesheets directly into Tailwind v4 semantic utilities and delete all 16 component/page `.css` files (no `@layer legacy` shim). `apps/storefront/src/index.css` remains the single CSS entrypoint.
2. **Two-Tier CSS-First Semantic Tokens (`Baseline 2024+`):**
   - Adopt an explicit **`Baseline 2024+`** browser support target (Chrome 123+, Safari 17.5+, Firefox 128+, matching the intersection of CSS `light-dark()` and Tailwind CSS v4's documented engine requirements).
   - Define semantic tokens once on `:root` using native CSS `light-dark()` + `color-scheme: light dark`, exposed to Tailwind utilities via `@theme inline` (`brand`, `surface`, `border`, `fg`, `success`, `warning`, `danger`, `info`, `skeleton-base`, `skeleton-highlight`, shadows, typography, container width, and `z-index` scale).
   - Eliminate all duplicated dark-mode token blocks and legacy `--text-color` aliases.
3. **Canonical Theme Activation & Anti-FOUC:**
   - Standardize theme activation on `html[data-theme="light" | "dark"]` paired with `<meta name="color-scheme" content="light dark">` and `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));`.
   - Run a minimal synchronous inline script in `apps/storefront/index.html` before first paint to resolve `localStorage['minieshop_theme']` (falling back to `matchMedia('(prefers-color-scheme: dark)')`) with zero Flash of Unstyled Content (FOUC).
   - Provide `useTheme()` (`system | light | dark` with live `prefers-color-scheme` change listener) and an accessible 3-way `System / Light / Dark` toggle in `Navbar` using inline vector SVGs.

## Consequences

### Positive
- Zero legacy stylesheet coupling (`/search`, PLP, PDP, Cart, and 404 are fully self-contained).
- Consistent light and dark rendering across every surface, status badge, skeleton loader, and native `<dialog>` backdrop with a single source of truth.
- Fixed PDP recommendation layout: `PdpRecommendationsSection` now renders full-width below the 2-column product grid.
- Clean foundation for Phase 8 (`@minieshop/ui` exporting `./tokens` consumable directly by Tailwind v4 via `@source`).

### Trade-offs
- Browsers older than Baseline 2024 (`light-dark()` / native `<dialog>`) are explicitly out of scope per the documented `Baseline 2024+` policy.
