# Spec-Driven Development (SDD)

This directory stores feature and architectural specifications authored **before** implementation begins. SDD ensures requirements, UI/accessibility constraints, state contracts, and acceptance criteria are explicit before writing code.

---

## SDD Workflow

1. **Draft Spec:** Copy [`template.md`](./template.md) to `NNNN-feature-slug.md` (e.g., `0001-dedicated-cart-and-checkout.md`).
2. **Align & Review:** Define functional scope, state/API contracts, UI tokens/dark-mode constraints, and edge cases. Record any structural decisions in `docs/adr/`.
3. **Implement:** Build strictly against the spec's acceptance criteria, adhering to `.agent/rules/`.
4. **Verify:** Pass `npm run lint`, `npm run build`, and browser flow validation (plus automated tests once introduced).
5. **Finalize Docs:** Mark spec status as `Implemented`, and update `docs/` inventories (`features.md`, `components.md`, `hooks.md`, `store.md`, `services.md`, `utils.md`) and `AGENTS.md`.

### Status Lifecycle
`Draft` -> `Approved` -> `In Progress` -> `Implemented` | `Superseded`

---

## Specification Index & Roadmap Queue

| ID | Spec | Phase | Status | Related ADR |
| :--- | :--- | :--- | :--- | :--- |
| `SDD-0001` *(planned)* | Dedicated Cart Page & Checkout Flow | Phase 6 | Not Started | — |
| `SDD-0002` *(planned)* | Automated Test Suite Adoption | Phase 6 / 7 | Not Started | — |
| [SDD-0003](./0003-incremental-typescript-migration.md) | Incremental TypeScript Migration | Pre-Phase 6 | Implemented | [ADR-0001](../adr/0001-vite-react-js-baseline.md), [ADR-0006](../adr/0006-incremental-typescript-migration.md) |
