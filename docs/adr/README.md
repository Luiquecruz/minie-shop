# Architecture Decision Records (Incremental ADR Log)

This directory maintains an **incremental, append-only log** of architectural decisions for **Progressive Minie Shop**. Because the application's architecture grows phase by phase, every significant technical decision—or revision of an earlier decision—must be captured here.

---

## Incremental Governance Rules

1. **Sequential Numbering:** Name files `NNNN-short-kebab-title.md` (zero-padded 4 digits: `0001`, `0002`, ...).
2. **Never Delete History:** Accepted ADRs are immutable historical records. If a decision changes later (for example, migrating from JS to TypeScript in Phase 7 or replacing `productsApi` with a real backend), create a **new** ADR and update the previous ADR's status to `Superseded by ADR-XXXX`.
3. **Required Triggers for a New ADR:**
   - Adding or replacing core dependencies (routing, state, styling, testing, validation, build plugins).
   - Changing architectural boundaries (e.g., introducing backend HTTP clients, adding a new Redux slice vs. React Context).
   - Executing major phase transitions (Phase 6 Checkout architecture, Phase 7 TypeScript migration).
4. **Update Index:** Add every new ADR to the table below in the same commit.

### Status Lifecycle
`Proposed` -> `Accepted` -> `Deprecated` | `Superseded by ADR-XXXX`

---

## ADR Index

| ID | Title | Phase | Status | Date |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-0001](./0001-vite-react-js-baseline.md) | Vite 8 + React 19 (JavaScript/JSX) with Oxlint Baseline | Phase 1 | Partially Superseded by ADR-0006 | 2026-10-23 |
| [ADR-0002](./0002-declarative-routing-and-root-layout.md) | Declarative Routing with Canonical `RootLayout` and `react-helmet-async` | Phase 2–4 | Accepted | 2026-10-24 |
| [ADR-0003](./0003-redux-toolkit-with-localstorage-persistence.md) | Redux Toolkit Store (`currency`, `cart`) with `localStorage` Persistence | Phase 3–5 | Accepted | 2026-10-27 |
| [ADR-0004](./0004-custom-hooks-and-abortable-simulated-api.md) | Custom Hooks Facade and Abortable Frontend-Only Simulated API | Phase 3–5 | Accepted | 2026-10-27 |
| [ADR-0005](./0005-css-tokens-dark-mode-and-svg-only-ui.md) | CSS Custom Properties Design System, Dark Mode, and SVG-Only UI | Phase 3–5 | Accepted | 2026-10-27 |
| [ADR-0006](./0006-incremental-typescript-migration.md) | Strict TypeScript Baseline & Extensionless Bundler Resolution | Pre-Phase 6 | Accepted | 2026-11-18 |
