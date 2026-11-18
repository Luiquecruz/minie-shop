# ADR-0006: Strict TypeScript Baseline & Extensionless Bundler Resolution

- **Status:** Accepted
- **Date:** 2026-11-18
- **Phase:** Pre-Phase 6 Milestone
- **Related SDD:** [`docs/sdd/0003-incremental-typescript-migration.md`](../sdd/0003-incremental-typescript-migration.md)

## Context
Through Phases 1–5, **Progressive Minie Shop** was authored in JavaScript (`.js` / `.jsx`) under [ADR-0001](./0001-vite-react-js-baseline.md), with TypeScript originally deferred to Phase 7. Ahead of Phase 6 (Dedicated Cart Page & Checkout Flow), the growing Redux store, multi-currency pricing engine, abortable API service, and async hooks benefited from static compile-time guarantees so Phase 6 can be implemented directly in strict TypeScript.

## Decision
- Adopt **TypeScript (`^7.0.2`)** across the entire application (`src/` and `vite.config.ts`), partially superseding [ADR-0001](./0001-vite-react-js-baseline.md) on language format and module specifiers.
- Configure `tsconfig.json` with `"strict": true`, `"allowJs": false`, `"noUnusedLocals": true`, `"noUnusedParameters": true`, `"noFallthroughCasesInSwitch": true`, `"moduleResolution": "bundler"`, `"jsx": "react-jsx"`, and `"noEmit": true`, plus `tsconfig.node.json` for `vite.config.ts` and `src/vite-env.d.ts` for Vite asset/style ambient types.
- Adopt **extensionless relative imports** (e.g., `../hooks/useCart`) across all `.ts` and `.tsx` modules.
- Enforce a **hybrid typing architecture**:
  - Centralized domain entities and API contracts in `src/types/` (`currency.ts`, `product.ts`, `cart.ts`, `api.ts`, `index.ts`).
  - Co-located exported component prop interfaces in each `.tsx` component file (including generic `DropdownProps<T>`).
  - Pre-typed Redux Toolkit hooks (`useAppDispatch`, `useAppSelector`) via React-Redux v9 `.withTypes()` in `src/store/hooks.ts`.
  - Generic `useFetch<T>` overloads and discriminated union async state models (`AsyncFetchState<T>` and `AsyncRequestState<T>`).
- Enforce a **zero-`any` policy** via Oxlint (`"typescript"` plugin with `"typescript/no-explicit-any": "error"`), runtime type guards for `localStorage` hydration, and `unknown` narrowing in `catch` blocks.
- Gate production builds on typechecking: `"typecheck": "tsc --noEmit"` and `"build": "tsc --noEmit && vite build"`.

## Alternatives Considered
- **Deferring TypeScript until after Phase 6:** Rejected because Phase 6 introduces checkout form validation, order state, and cart route contracts that are safer to author directly with strict static types.
- **Using JSDoc + `checkJs` instead of `.ts`/`.tsx`:** Rejected because discriminated union narrowing, generic React components (`Dropdown<T>`), and overloaded hooks (`useFetch<T>`) are much cleaner and better supported in native TypeScript syntax.

## Consequences
### Positive
- Compile-time verification across utilities, mock data, simulated API, Redux slices, custom hooks, components, and route pages.
- Strict null-safety and discriminated union exhaustiveness checks prevent invalid loading/error/data state combinations.
- Zero runtime bundle overhead (`noEmit: true`, Vite strips types during bundling).

### Negative / Trade-offs
- Requires maintaining explicit interfaces when adding new product fields, slice payloads, or component props in Phase 6 and beyond.

## Incremental Evolution Notes
Future Phase 6 (Cart & Checkout) and automated testing adoption (SDD-0002) will build directly on this strict TypeScript baseline.
