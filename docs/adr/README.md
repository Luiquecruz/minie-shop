# Architecture Decision Records (Incremental ADR Log)

This directory maintains an **incremental, append-only log** of architectural decisions for **Progressive Minie Shop**. Because the application's architecture grows phase by phase, every significant technical decision—or revision of an earlier decision—must be captured here.

---

## Incremental Governance Rules

1. **Sequential Numbering:** Name files `NNNN-short-kebab-title.md` (zero-padded 4 digits: `0001`, `0002`, ...).
2. **Never Delete History:** Accepted ADRs are immutable historical records. If a decision changes later, create a **new** ADR and update the previous ADR's status to `Superseded by ADR-XXXX` (or `Partially Superseded by ADR-XXXX`). *(Note: Prior to starting the backend journey, the ten initial frontend ADRs `0001`–`0010` were consolidated into [`ADR-0001`](./0001-frontend-architecture-baseline.md); their individual records remain preserved in Git history.)*
3. **Required Triggers for a New ADR:**
   - Adding or replacing core dependencies (backend frameworks, databases, ORMs, auth, routing, state, styling, testing, validation, build plugins).
   - Changing architectural boundaries (e.g., introducing backend HTTP clients, API contracts, server-side persistence, new Redux slices vs. React Query).
   - Executing major phase transitions (Backend integration, Checkout & Orders architecture).
4. **Update Index:** Add every new ADR to the table below in the same commit.

### Status Lifecycle
`Proposed` -> `Accepted` -> `Deprecated` | `Superseded by ADR-XXXX`

---

## ADR Index

| ID | Title | Phase | Status | Date |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-0001](./0001-frontend-architecture-baseline.md) | Frontend Architecture Baseline (Phases 1–6 Inc. 2) | Phases 1–6 (Inc. 2) | Accepted | 2026-11-21 |
