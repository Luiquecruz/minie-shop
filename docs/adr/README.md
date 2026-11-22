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
| [ADR-0002](./0002-monolito-modular-monorepo.md) | Monolito Modular em Monorepo e Gatilhos de Extração *(spec ADR-001)* | Backend Fase 1 (`T01`) | Accepted | 2026-11-21 |
| [ADR-0003](./0003-framework-e-orm-nestjs-drizzle.md) | Framework Backend (NestJS + Fastify) e ORM (Drizzle) *(spec ADR-002)* | Backend Fase 1 (`T01`) | Accepted | 2026-11-21 |
| [ADR-0004](./0004-storage-midia-s3-seaweedfs.md) | Storage de Mídia S3-Compatível (SeaweedFS) *(spec ADR-003)* | Backend Fase 1 (`T01`) | Accepted | 2026-11-21 |
| [ADR-0005](./0005-imagem-fallback-no-frontend.md) | Imagem de Fallback Vive no Frontend, Nunca no Bucket *(spec ADR-004)* | Backend Fase 1 (`T01`) | Accepted | 2026-11-21 |
| [ADR-0006](./0006-organizacao-banco-schemas-por-modulo.md) | Organização do Banco de Dados — Um Schema por Módulo *(spec ADR-008)* | Backend Fase 1 (`T01`) | Accepted | 2026-11-21 |
| [ADR-0007](./0007-autenticacao-sessoes-opacas-propria.md) | Autenticação — Implementação Própria com Sessões Opacas no Servidor *(spec ADR-009)* | Backend Fase 1 (`T01`) | Accepted | 2026-11-21 |
| [ADR-0008](./0008-contratos-api-publica-erros-e-status-produto.md) | Contratos Públicos da API do Catálogo, Envelope de Erros e Status de Publicação | Backend Fase 2 (`T11`) | Accepted | 2026-11-22 |
