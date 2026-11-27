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
| [ADR-0009](./0009-vitest-testes-integracao-api-e-banco-isolado.md) | Vitest para Testes de Integração HTTP da API e Banco `app_test` Isolado | Backend Fase 2 (`T18`) | Accepted | 2026-11-22 |
| [ADR-0010](./0010-meilisearch-como-motor-de-busca.md) | Meilisearch como Motor de Busca atrás de `SearchPort` *(spec ADR-005)* | Backend Fase 3 (`S01`) | Accepted | 2026-11-22 |
| [ADR-0011](./0011-pipeline-unico-de-embeddings-pgvector.md) | Pipeline Único de Embeddings com pgvector e Embedder `userProvided` *(spec ADR-006)* | Backend Fase 3 (`S01`) | Partially Superseded by ADR-0022 | 2026-11-22 |
| [ADR-0012](./0012-outbox-postgres-e-worker-segundo-entrypoint.md) | Outbox Transacional em PostgreSQL e Worker como Segundo Entrypoint *(spec ADR-010)* | Backend Fase 3 (`S03`) | Accepted | 2026-11-22 |
| [ADR-0013](./0013-recomendacoes-pre-calculadas-e-curadoria.md) | Recomendações Pré-Calculadas em Tabela, Curadoria Manual e Fallback por Regra *(spec ADR-007)* | Backend Fase 4 (`R01`) | Accepted | 2026-11-22 |
| [ADR-0014](./0014-sessoes-cookies-csrf-e-parametros-seguranca.md) | Sessões Opacas, Cookies (`__Host-`), Senhas (Argon2id) e Proteção CSRF *(spec ADR-011)* | Backend Fase 5 (`I01`) | Accepted | 2026-11-22 |
| [ADR-0015](./0015-email-transporte-tokens-assinados-e-mailpit.md) | E-mail Transacional — `packages/email`, Tokens Assinados, Outbox e Mailpit *(spec ADR-012)* | Backend Fase 5 (`I03`) | Accepted | 2026-11-22 |
| [ADR-0016](./0016-monorepo-pnpm-workspaces-turborepo.md) | Monorepo com pnpm Workspaces e Turborepo | Fase 6 (`T20`) | Accepted | 2026-11-23 |
| [ADR-0017](./0017-camada-dados-storefront-repositorio-cursor-rotas.md) | Camada de Dados do Storefront, Parse Tolerante, Paginação por Cursor e Rotas Canônicas | Fase 6 (`T22`/`T23`) | Accepted | 2026-11-23 |
| [ADR-0018](./0018-multicurrency-pricing-and-storefront-i18n.md) | Server-Side Multi-Currency Pricing, Progressive Cart Repricing, and Storefront i18n | Phase 6.1 (`SDD-0005`) | Accepted | 2026-11-23 |
| [ADR-0019](./0019-busca-na-ui-instantsearch-lazy.md) | Busca na UI — React InstantSearch Restrito à Rota Preguiçosa `/search` vs `useInfiniteQuery` | Fase 7 (`S08.3`) | Accepted | 2026-11-24 |
| [ADR-0020](./0020-combobox-autocomplete-apg-proprio.md) | Combobox de Autocomplete no Cabeçalho — Implementação Própria WAI-ARIA APG vs Downshift | Fase 7 (`S08.2`) | Accepted | 2026-11-24 |
| [ADR-0021](./0021-carregamento-preguicoso-recomendacoes-pdp.md) | Carregamento Preguiçoso dos Blocos de Recomendação na PDP | Fase 7 (`R05.2`, `R05.4`) | Accepted | 2026-11-24 |
| [ADR-0022](./0022-upgrade-embeddings-model-to-embeddinggemma-2.md) | Upgrade Local Embedding Model from `embeddinggemma` (v1) to `embeddinggemma-2` | Alignment (`chore/docs-and-docker-alignment`) | Accepted | 2026-11-26 |
| [ADR-0023](./0023-monorepo-package-boundaries-stack-typescript-and-contracts.md) | Monorepo Package Boundaries, Stack-Pinned TypeScript, and Publish-Ready Contracts | Pre-Phase 8 (`chore/monorepo-security-and-api-hardening`) | Accepted | 2026-11-26 |
| [ADR-0024](./0024-tailwind-v4-semantic-tokens-and-theme-activation.md) | Tailwind CSS v4, Two-Tier CSS-First Semantic Tokens & Theme Activation | Pre-Phase 8 (`feat/storefront-tailwind-v4-and-tokens`) | Accepted | 2026-11-27 |
