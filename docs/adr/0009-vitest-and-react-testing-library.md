# ADR-0009: Vitest & React Testing Library Adoption

- **Status:** Accepted
- **Date:** 2026-11-21
- **Phase:** Phase 6 — Increment 2
- **Related Rules:** [`.agent/rules/testing.md`](../../.agent/rules/testing.md)

## Context
Migrating `CartPage` from monolithic React Context + `useReducer` to pure functional Redux Toolkit reducers and memoized `createSelector` selectors requires deterministic automated verification of:
1. Pure reducer immutability and `localStorage` persistence hydration/listeners.
2. Selector memoization (`recomputations()`) and structural sharing.
3. Before-vs-after React `<Profiler>` re-render isolation benchmarks.

## Decision
- Adopt **Vitest** (`^5.1.1`) paired with **`@testing-library/react`**, **`@testing-library/user-event`**, **`@testing-library/jest-dom`**, and **`jsdom`**.
- Configure Vitest in [`vitest.config.ts`](../../vitest.config.ts) with setup file [`src/test/setup.ts`](../../src/test/setup.ts) (auto-cleanup + `localStorage.clear()` between tests).
- Colocate test files next to the modules they verify using the `*.test.ts` / `*.test.tsx` naming convention (e.g., `src/store/slices/cartSlice.test.ts`, `src/store/selectors/cartSelectors.test.ts`, `src/pages/CartPage/__tests__/CartPage.profiler.test.tsx`).
- Add `npm test` (`vitest run`) and `npm run test:watch` (`vitest`) scripts to `package.json`, and include `vitest.config.ts` in `tsconfig.node.json`.

## Consequences
### Positive
- Integrates natively with Vite 8 and strict TypeScript (`tsc --noEmit`).
- Enables fast, deterministic unit tests for reducers/selectors and programmatic React `<Profiler>` assertions in CI and local development.

### Negative / Trade-offs
- Adds `vitest`, `@testing-library/*`, and `jsdom` to `devDependencies` (zero impact on production bundle).
