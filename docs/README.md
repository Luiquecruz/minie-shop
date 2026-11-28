# Progressive Minie Shop — Documentation Hub

Central, incremental documentation for the **react-minieshop** monorepo architecture, design patterns, implemented features, code inventories, Architecture Decision Records (ADRs), empirical metrics, and Spec-Driven Development (SDD) specifications.

---

## Documentation Map

| Document | Scope | Update Trigger |
| :--- | :--- | :--- |
| [design-patterns.md](./design-patterns.md) | Living catalog of frontend, backend, and contract design patterns, trade-offs, and intentional absences | **Every time** a design pattern is introduced, refactored, or retired |
| [architecture.md](./architecture.md) | High-level system architecture, module & layer boundaries, outbox topology, and data flows | Architectural shifts or new phases |
| [api.md](./api.md) | Public HTTP API contracts, error envelope, caching, and endpoint behavior | New or changed API endpoints / schemas |
| [db-model.md](./db-model.md) | Multi-schema PostgreSQL 17 data model, constraints, indexes, and relations | Schema migrations or table ownership changes |
| [security.md](./security.md) | Authentication, opaque sessions, CSRF, RBAC, STRIDE threat model, and audit parameters | Auth, permission, or security header changes |
| [chaos-dev-guide.md](./chaos-dev-guide.md) | DEV-only chaos header injection and failure testing | Changes to chaos middleware or debug panel |
| [search-evolution.md](./search-evolution.md) | Roadmap triggers for evolving listing/facets onto Meilisearch | Search architecture changes |
| [features.md](./features.md) | End-to-end user-facing features and phase status | New or modified product features |
| [components.md](./components.md) | Storefront layouts, pages, and reusable Tailwind CSS v4 UI components | New or modified TSX components |
| [hooks.md](./hooks.md) | Custom React hooks (`useCart`, `useCurrency`, `useTheme`, `useCombobox`, `useInView`, query & chaos hooks) | New or modified hooks |
| [store.md](./store.md) | Pure Redux Toolkit store, slices, memoized selectors & listener persistence | Store or slice changes |
| [services.md](./services.md) | `ProductRepository` port, `HttpClient` (CSRF + abort), `HttpProductRepository`, `MockProductRepository`, `instantSearchAdapter` | Repository methods or client contracts |
| [utils.md](./utils.md) | `cn`, integer-cents money formatting, currency metadata, and Zod URL param parsers | Utility logic updates |
| [metrics/](./metrics/) | Empirical benchmarks (`search-relevance.md`, `recommendations-quality.md`, `frontend-api-integration.md`, `search-and-recommendations-ui.md`) | Benchmark or performance budget changes |
| [adr/README.md](./adr/README.md) | Incremental Architecture Decision Records log (`ADR-0001`–`ADR-0024`) & template | Any structural/tooling/stack decision |
| [sdd/README.md](./sdd/README.md) | Spec-Driven Development workflow, backlog & spec template | Before implementing new features |

---

## Incremental Documentation Protocol

This codebase evolves phase by phase. Keep documentation synchronized in the same change set as code:

1. **Before coding a major feature:** Draft an SDD spec in [`docs/sdd/`](./sdd/README.md).
2. **When making an architectural decision:** Append a sequential ADR in [`docs/adr/`](./adr/README.md) and never silently overwrite historical decisions (mark superseded ADRs explicitly via status headers only).
3. **When introducing, refactoring, or retiring any pattern:** Update [`docs/design-patterns.md`](./design-patterns.md) in the same PR.
4. **When adding or editing modules:** Update the corresponding inventory (`components.md`, `hooks.md`, `store.md`, `services.md`, `utils.md`, `api.md`, `db-model.md`) and keep [`AGENTS.md`](../AGENTS.md) and root [`README.md`](../README.md) current.
