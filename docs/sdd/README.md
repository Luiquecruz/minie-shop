# Spec-Driven Development (SDD)

This directory stores feature and architectural specifications authored **before** implementation begins. SDD ensures requirements, UI/accessibility constraints, state contracts, and acceptance criteria are explicit before writing code.

---

## SDD Workflow

1. **Create a Dedicated Branch:** Before writing spec code, verify `git branch --show-current` and create a dedicated branch with a clear, objective name (e.g., `git checkout -b feat/dedicated-cart-page`). Never include `sdd` or spec numbers in branch names, and never implement a new spec on `main` or another spec's branch.
2. **Draft Spec:** Copy [`template.md`](./template.md) to `NNNN-feature-slug.md` (e.g., `0001-dedicated-cart-and-checkout.md`).
3. **Align & Review:** Define functional scope, state/API contracts, UI tokens/dark-mode constraints, and edge cases. Record any structural decisions in `docs/adr/`.
4. **Implement:** Build strictly against the spec's acceptance criteria, adhering to `.agent/rules/`.
5. **Verify:** Pass `npm run typecheck`, `npm run lint`, `npm run build`, and browser flow validation (plus automated tests once introduced).
6. **Finalize Docs:** Mark spec status as `Implemented`, and update `docs/` inventories (`features.md`, `components.md`, `hooks.md`, `store.md`, `services.md`, `utils.md`) and `AGENTS.md`.

### Status Lifecycle
`Draft` -> `Approved` -> `In Progress` -> `Implemented` | `Superseded`

---

## Specification Index & Roadmap Queue

| ID | Spec | Phase | Status | Related ADR |
| :--- | :--- | :--- | :--- | :--- |
| [SDD-0001](./0001-dedicated-cart-and-checkout.md) | Dedicated Cart Page & Checkout Flow (Inc. 1–2: CartPage Redux + Profiler) | Phase 6 | In Progress (Inc. 1–2 Implemented; Checkout Inc. 3 Pending) | [ADR-0003](../adr/0003-redux-toolkit-with-localstorage-persistence.md), [ADR-0008](../adr/0008-cart-page-context-reducer-baseline.md), [ADR-0009](../adr/0009-vitest-and-react-testing-library.md), [ADR-0010](../adr/0010-cart-page-redux-memoized-selectors.md) |
| `SDD-0002` *(planned)* | Automated Test Suite Adoption | Phase 6 / 7 | Not Started | — |
| [SDD-0003](./0003-incremental-typescript-migration.md) | Incremental TypeScript Migration | Pre-Phase 6 | Implemented | [ADR-0001](../adr/0001-vite-react-js-baseline.md), [ADR-0006](../adr/0006-incremental-typescript-migration.md) |
| [SDD-0004](./0004-tanstack-react-query-migration.md) | TanStack React Query Migration & Optimistic Favorites | Post-Phase 5 | In Progress | [ADR-0004](../adr/0004-custom-hooks-and-abortable-simulated-api.md), [ADR-0007](../adr/0007-tanstack-react-query-server-state.md) |
