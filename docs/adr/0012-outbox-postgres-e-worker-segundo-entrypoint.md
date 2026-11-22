# ADR-0012 — Outbox Transacional em PostgreSQL e Worker como Segundo Entrypoint *(spec ADR-010)*

- **Status:** Accepted
- **Date:** 2026-11-22
- **Phase:** Backend Fase 3 (`S03`)

---

## Contexto

Com a introdução do Meilisearch e do pipeline de embeddings (`pgvector`), mudanças em produtos, estoque ou categorias no PostgreSQL precisam propagar de forma assíncrona e confiável para o índice de busca e para a geração de vetores, sem perda de eventos em caso de crash da API ou indisponibilidade temporária do Meilisearch/Ollama, e sem adicionar brokers pesados ao ambiente local de custo zero.

---

## Decisão

1. **Outbox transacional em `platform.outbox` (PostgreSQL):**
   - `OutboxService.enqueue(tx, event)` grava os registros **na mesma transação** da alteração de domínio (atomicidade garantida pelo PostgreSQL).
   - **Um registro por consumidor (`consumer`):** um mesmo evento (`product.changed`) gera linhas independentes para `search-index` e `embeddings`. A falha ou lentidão de um consumidor (ex.: Ollama fora do ar) nunca bloqueia o outro (ex.: indexação lexical).
   - **Handlers baseados em estado e idempotentes:** o `payload` carrega apenas IDs; o handler lê o estado atual no PostgreSQL. A ordem entre eventos do mesmo produto não importa e reprocessar é sempre seguro.
   - **Polling seguro com `FOR UPDATE SKIP LOCKED` e lease (`locked_until`):** o worker reivindica lotes em transação curta, processa fora da transação, aplica retry com backoff exponencial + jitter e move para `dead` ao atingir `WORKER_MAX_ATTEMPTS`. Leases expirados são reivindicados automaticamente.
2. **Worker como segundo entrypoint na mesma base de código (`apps/api/src/worker/main.ts`):**
   - Reaproveita a mesma imagem Docker (`apps/api/Dockerfile`) com outro `command` (`pnpm worker:dev` / `pnpm worker:start`) e healthcheck HTTP próprio (`:3002/health`).
   - Como o monorepo ainda não usa workspaces na raiz, manter o worker como segundo entrypoint evita duplicação de código e permite injetar diretamente os módulos NestJS (`PlatformModule`, `CatalogModule`, `SearchModule`).

---

## Alternativas Consideradas e Descartadas

- **Kafka / RabbitMQ:** excelente para alta vazão distribuída, mas adiciona complexidade operacional e consumo de memória desproporcionais para um monolito modular local, além de ainda exigir padrão outbox para evitar dual-write com o Postgres.
- **BullMQ (Redis):** exigiria introduzir Redis (explicitamente fora de escopo nesta fase) e ainda sofreria com dual-write entre Postgres e Redis.
- **Pacote separado `apps/worker`:** sem workspace pnpm na raiz, exigiria duplicar wiring de módulos, schemas e build de Docker sem ganho prático.

---

## Consequências

- **Positivas:** zero infraestrutura extra; consistência transacional forte (sem dual-write); isolamento de falhas por consumidor; operações simples de observabilidade e recuperação (`outbox:stats`, `outbox:requeue`, `outbox:wait-drain`).
- **Trade-offs:** polling sobre o PostgreSQL exige índice dedicado (`outbox_polling_idx`) e rotina de limpeza de eventos `processed` após `OUTBOX_RETENTION_DAYS` dias.
