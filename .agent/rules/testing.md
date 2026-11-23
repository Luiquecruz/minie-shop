---
trigger: model_decision
description: "Typechecking, linting, production build checks, browser validation cadence, and future automated testing standards."
---

# Testing & Verification Rules

## 1. Current Verification Baseline
At the current milestone (Phase 6 Increment 2 — Vitest + React Testing Library captured in `ADR-0001`), every code change must pass the following verification gates:

1. **Automated Tests (`npm test`):** Executes `vitest run` across reducer, memoized selector, and React `<Profiler>` tests. Must finish with `0 failures`.
2. **Static Typechecking (`npm run typecheck`):** Executes `tsc --noEmit` using strict `tsconfig.json`. Must finish with `0 errors`.
3. **Static Linting (`npm run lint`):** Executes `oxlint` using `.oxlintrc.json` (`react`, `oxc`, `typescript` plugins). Must finish with `0 warnings and 0 errors`.
4. **Production Bundle (`npm run build`):** Executes `tsc --noEmit && vite build` to verify TypeScript compilation, module resolution, TSX compilation, and CSS bundling.
5. **Browser Validation Cadence:** Perform end-to-end browser inspection at the conclusion of each implemented user flow or upon explicit user request. Avoid spawning heavy browser checks for purely documentation edits.

## 2. Browser Flow Validation Checklist
When validating UI flows in the browser (`npm run dev` on `http://localhost:5199`):
- **PLP (`/`):** Category chip filtering, sort dropdown (`Default`, `Lowest Price`, `Highest Price`, `Top Rated`, `Name (A - Z)`), skeleton loading, empty/error states, and `Add to Cart`.
- **SearchBar (`Navbar`):** Debounced autocomplete (`300ms`), match highlighting, keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`), clear button, and navigation to `/product/:id`.
- **Multi-Currency (`Navbar` + `PriceBox` + `MiniCart`):** Switching `BRL`, `USD`, and `EUR` updates all prices and persists across page reloads (`minieshop_currency`).
- **PDP (`/product/:id`):** Dynamic `<title>` via `react-helmet-async`, open masonry gallery, 3-tab switching (`Description`, `Manufacturer`, `Technical Specs`), floating action bar, and related products.
- **MiniCart (`RootLayout`):** Auto-open on add, quantity increment/decrement/input guardrails (`1..stock`), debounced `validateStock` (`300ms`), warning alerts, item removal, and `localStorage` persistence (`minieshop_cart`).
- **Visual & Responsive Quality:** Check desktop, tablet, and mobile layouts plus light and dark color schemes, confirming zero emojis in the UI.

## 3. Rules for Introducing Automated Tests (Future Incremental Phase)
- Before installing a test runner (e.g., Vitest + React Testing Library + Playwright), record an ADR in `docs/adr/` defining the tool choice, folder convention, and `package.json` test scripts.
- Prioritize the test pyramid incrementally:
  1. **Unit tests:** `src/utils/price.ts`, `src/utils/currency.ts`, `src/store/slices/cartSlice.ts`, `src/store/slices/currencySlice.ts`, and `src/services/api.ts`.
  2. **Hook & Component tests:** `useFetch` (`AbortController` + fake timers for debounce), `useCart`, `useCurrency`, `Dropdown`, `SearchBar`, `PriceBox`, and `MiniCart`.
  3. **E2E tests:** Critical shopping journeys (browse -> search -> PDP -> add to cart -> currency switch -> reload persistence).
- Isolate `localStorage` and clean up fake timers between test cases so tests remain deterministic.
