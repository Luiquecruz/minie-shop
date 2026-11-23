# ADR-0009 — Vitest para Testes de Integração HTTP da API e Banco `app_test` Isolado

- **Status:** Accepted
- **Date:** 2026-11-22
- **Phase:** Backend Fase 2 (`T18`)

---

## Contexto

Na Fase 1, o teste de integração do seed e do `MediaService` (`src/seed/seed-and-media.integration.test.ts`) foi implementado com o runner nativo `node:test` (`tsx --test`) operando contra o banco `minieshop` e SeaweedFS do Compose.

Na Fase 2 (`T18`), precisamos de uma suíte completa de testes de integração HTTP da API via `app.inject()` do Fastify, executada contra um banco PostgreSQL real e isolado (`app_test`), com fábricas de dados próprias (sem depender do seed completo) e execução determinística via `pnpm test:integration` e `make -C infra test`.

---

## Decisão

1. **Adotar Vitest (`vitest run`) para a suíte de integração HTTP da API (`*.integration.spec.ts`):**
   - Script dedicado `pnpm test:integration` em `apps/api/package.json` executando `vitest run` com `fileParallelism: false` em `apps/api/vitest.config.ts`.
   - O teste da Fase 1 (`src/seed/seed-and-media.integration.test.ts`) e os testes unitários leves (`src/common/*.test.ts`) permanecem em `node:test` (`pnpm test`), preservando intacta a entrega da Fase 1.
   - `make -C infra test` executa `pnpm test && pnpm test:integration`.
2. **Banco `app_test` separado, criado e migrado automaticamente no setup:**
   - `src/test/integration-db.ts` garante a existência do banco `app_test` no Postgres do Compose, aplica todas as migrations Drizzle (`apps/api/drizzle/`) e trunca as tabelas de `catalog` e `media` entre testes (`beforeEach`).
3. **Fábricas de dados próprias (`src/test/factories.ts`):**
   - Cada cenário cria exatamente as categorias, atributos, produtos (`published`/`draft`/`archived`) e ativos de mídia (`ready`/`pending`/`failed`) necessários, garantindo determinismo completo.

---

## Alternativas Consideradas

- **Usar apenas `node:test` para tudo:** viável, mas Vitest oferece melhor ergonomia de asserções, relatório detalhado de falhas e alinhamento direto com o ecossistema já utilizado no frontend do repositório.
- **Reescrever os testes da Fase 1 em Vitest:** descartado para não mexer desnecessariamente na suíte da Fase 1 já validada.

---

## Consequências

- **Positivas:** execução determinística e isolada em `app_test` sem contaminar o banco de desenvolvimento `minieshop`; relatórios claros no local e no CI.
- **Trade-offs:** convivência controlada de dois scripts (`pnpm test` para `node:test` e `pnpm test:integration` para Vitest), ambos agregados em `make -C infra test` e no workflow do CI.
