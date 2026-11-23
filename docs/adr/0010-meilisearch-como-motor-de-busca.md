# ADR-0010 — Meilisearch como Motor de Busca atrás de `SearchPort` *(spec ADR-005)*

- **Status:** Accepted
- **Date:** 2026-11-22
- **Phase:** Backend Fase 3 (`S01`)

---

## Contexto

Na Fase 2 entregamos busca textual básica via PostgreSQL Full-Text Search (`to_tsvector('portuguese', unaccent(...))` + índice GIN). Embora suficiente para filtros estruturados do catálogo, o Postgres FTS puro não oferece:

- Tolerância a erros de digitação (typo tolerance) em tempo real para caixa de busca e autocomplete (`suggest`).
- Expansão nativa de sinônimos comerciais em português com ranking ajustável por peso de atributo.
- Busca híbrida (combinação nativa de relevância lexical + similaridade vetorial) em baixa latência.

Precisamos introduzir um motor de busca gratuito, open source e executável localmente em container sem acoplar o domínio do catálogo ao fornecedor escolhido, mantendo o PostgreSQL como **fonte da verdade** e o índice de busca como **projeção derivada e descartável**.

---

## Decisão

1. **Adotar o Meilisearch (edição community, licença MIT, versão fixa `getmeili/meilisearch:v1.57.0`) atrás de uma porta `SearchPort` (`apps/api/src/modules/search/`):**
   - O restante da aplicação comunica-se exclusivamente com `SearchPort` (`search`, `suggest`, `upsert`, `delete`, `reindex`, `health`), isolado por `MeilisearchAdapter`.
   - O navegador **nunca** acessa o Meilisearch diretamente; toda busca passa pela API (`GET /search` e `GET /search/suggest`). A porta do motor é publicada apenas em `127.0.0.1` para depuração local.
2. **Escopo atual (Fase 3) e evolução documentada:**
   - Nesta fase, o Meilisearch atende **exclusivamente a caixa de busca** (`/search` e `/search/suggest`).
   - Listagem por categoria, filtros e facetas do catálogo permanecem servidos pelo PostgreSQL (rotas da Fase 2).
   - Os gatilhos, mudanças arquiteturais e mitigações para uma migração futura de listagem/filtros para o motor estão documentados em [`docs/search-evolution.md`](../search-evolution.md).
3. **Documento enxuto + hidratação pelo PostgreSQL:**
   - O índice guarda apenas campos de busca, filtro e ordenação (`id`, `slug`, `name`, `description`, `brand`, `categoryPath`, `categoryNames`, `attributesText`, `price`, `inStock`, `createdAt` e `_vectors`). Nenhum dado de exibição (imagens, placeholders, highlights completos) entra no índice.
   - A API obtém os `id`s ordenados do motor e **hidrata os `ProductCardDTO` a partir do PostgreSQL** preservando a ordem do motor e descartando produtos não publicados — garantindo preço e estoque sempre atuais.
4. **Privilégio mínimo desde dev:**
   - O serviço `init-search` (idempotente) configura o índice `products` e cria duas chaves escopadas com UID determinístico: uma chave **somente busca** (montada `:ro` para a `api`) e uma chave de **escrita no índice `products`** (montada `:ro` para o `worker`). A `MEILI_MASTER_KEY` fica restrita a `init-search` e comandos operacionais (`search:reindex`).
5. **Degradação em camadas + Circuit Breaker:**
   - Todas as buscas respondem `HTTP 200` com campo `mode`: `hybrid` -> `keyword` (se embedding falhar/timeout) -> `postgres` (se o Meilisearch estiver indisponível ou com circuit breaker aberto).

---

## Alternativas Consideradas e Descartadas

- **OpenSearch:** excelente para grandes clusters analíticos, mas pesado demais em memória/operação para um e-commerce showcase local de custo zero.
- **Typesense:** rápido, porém sob licença GPL-3 e com arquitetura centrada em índice residente em RAM, menos previsível em ambientes locais com memória restrita.
- **Algolia:** SaaS proprietário, não roda localmente e possui limites no plano gratuito (viola o requisito de custo zero e execução 100% local).
- **Apenas PostgreSQL FTS (+ pg_trgm):** evita infraestrutura extra, mas não entrega tolerância a typos ergonômica, sinônimos declarativos nem busca híbrida pronta para caixa de busca de e-commerce.

---

## Consequências

- **Positivas:** busca tolerante a typos, sinônimos em PT-BR e busca híbrida com custo zero; acoplamento controlado por `SearchPort`; degradação graciosa garantida para o Postgres se o motor cair; índice 100% reconstruível via `pnpm search:reindex`.
- **Trade-offs:** adiciona um container (`search`) e sincronização assíncrona via outbox/worker (`ADR-0012`), exigindo disciplina para nunca tratar o índice como fonte da verdade.
