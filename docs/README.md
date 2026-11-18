# Progressive Minie Shop — Documentation Hub

Central, incremental documentation for the **react-minieshop** architecture, implemented features, code inventory, Architecture Decision Records (ADRs), and Spec-Driven Development (SDD) specifications.

---

## Documentation Map

| Document | Scope | Update Trigger |
| :--- | :--- | :--- |
| [architecture.md](./architecture.md) | High-level architecture, routing, state & data flow, design tokens, phase roadmap | Architectural shifts or new phases |
| [features.md](./features.md) | End-to-end user-facing features and phase status | New or modified product features |
| [components.md](./components.md) | Layouts, pages, and reusable UI components | New or modified TSX/CSS components |
| [hooks.md](./hooks.md) | Custom React hooks (`useCart`, `useCurrency`, `useFetch`) | New or modified hooks |
| [store.md](./store.md) | Redux Toolkit store, slices, actions, selectors & persistence | Store or slice changes |
| [services.md](./services.md) | Simulated API service (`productsApi`) and mock catalog dataset | API methods or data schema changes |
| [utils.md](./utils.md) | Pure pricing and multi-currency engines | Utility logic or rate/currency updates |
| [adr/README.md](./adr/README.md) | Incremental Architecture Decision Records log & template | Any structural/tooling/stack decision |
| [sdd/README.md](./sdd/README.md) | Spec-Driven Development workflow, backlog & spec template | Before implementing new features |

---

## Incremental Documentation Protocol

This codebase evolves phase by phase. Keep documentation synchronized in the same change set as code:

1. **Before coding a major feature:** Draft an SDD spec in [`docs/sdd/`](./sdd/README.md).
2. **When making an architectural decision:** Append a sequential ADR in [`docs/adr/`](./adr/README.md) and never silently overwrite historical decisions (supersede old ADRs instead).
3. **When adding or editing modules:** Update the corresponding inventory (`features.md`, `components.md`, `hooks.md`, `store.md`, `services.md`, `utils.md`) and mark the current phase in `AGENTS.md` and `architecture.md`.
