# ADR-0008 — Contratos Públicos da API do Catálogo, Envelope de Erros e Status de Publicação

- **Status:** Accepted
- **Date:** 2026-11-22
- **Phase:** Backend Fase 2 (`T11`)

---

## Contexto

Na Fase 2 expomos a API HTTP pública do catálogo (`/categories`, `/products`, `/products/facets`, `/products/:slug` e `/favorites`) para consumo pelo SPA e por clientes futuros. Precisamos garantir:

1. Nenhum campo interno de banco (como `sku`, `regular_price_cents`, `search_vector` ou `session_id`) vaze acidentalmente nas respostas HTTP.
2. Um formato único e previsível de erro em toda a API (incluindo erros de validação Zod, rotas inexistentes 404, caos e falhas 500).
3. Filtragem estrita de produtos **publicados** em todas as rotas públicas e reserva do slug `facets` para evitar colisão com `GET /products/:slug`. Na Fase 1 (`0003_catalog_schema.sql`), `catalog.products` ainda não possuía coluna de publicação nem constraint de slug reservado.
4. Fronteira de módulo preservada (`ADR-0006`) no carregamento em lote de imagens prontas (`status = 'ready'`).

---

## Decisão

1. **Contratos públicos com `.strict()` em `@minieshop/contracts` (`packages/contracts/src/catalog/public.ts` e `src/errors.ts`):**
   - Todos os schemas de saída públicos usam `.strict()`. Cada rota passa pelo fluxo `consulta -> mapper explícito -> parseOutput(Schema, dto)` antes de serializar a resposta.
   - `price` nos DTOs públicos segue estritamente `{ amount: number /* centavos */, currency: string }`, representando o preço efetivo (`COALESCE(special_price_cents, regular_price_cents)`).
   - `GET /categories` retorna array raiz `CategoryDTO[]` (árvore recursiva com `productCount` somando nó + descendentes).
   - `FacetsDTO.price` retorna `{ min: null, max: null }` quando o conjunto filtrado está vazio.
2. **Envelope único de erro e filtro global (`GlobalExceptionFilter` + `setNotFoundHandler`):**
   - Formato: `{ error: { code, message, details?, requestId } }` com `code` em enum estável (`VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`, `RATE_LIMITED`, `CHAOS_FAILURE`, `BAD_REQUEST`, `CONFLICT`).
   - `ZodError` vira `400 VALIDATION_ERROR` com `details: [{ path, message }]`; exceções não tratadas viram `500 INTERNAL_ERROR` genérico sem stack trace na resposta (stack completo no log estruturado com `requestId`).
3. **Migration `0006_catalog_product_status_and_slug_constraint.sql`:**
   - Adiciona `status text NOT NULL DEFAULT 'published'` com `CHECK (status IN ('draft', 'published', 'archived'))` e índice `products_status_idx`.
   - Adiciona `CHECK (slug <> 'facets')` na tabela `catalog.products`, mantendo o seed da Fase 1 intacto (todos os 30 produtos entram como `published`).
4. **Fronteira `catalog` -> `media` em lote:**
   - O módulo `catalog` lê apenas `catalog.product_images` (seu próprio schema), coleta os `media_asset_id` distintos da página e invoca `MediaService.getReadyAssetsByIds(assetIds)` uma única vez por página (sem N+1 e sem leitura cross-schema por nenhum módulo).
5. **CORS e Cache HTTP:**
   - CORS via `@fastify/cors` configurado por `CORS_ORIGINS` (default `http://localhost:5199`, porta do Vite em `vite.config.ts`), `credentials: true` e cabeçalhos `x-chaos-*` liberados no preflight.
   - ETag fraco (`W/"..."`) + `Cache-Control: public, max-age=30` (com suporte a `If-None-Match` -> `304`) nas rotas públicas de leitura do catálogo; `Cache-Control: no-store` nas rotas de favoritos.

---

## Alternativas Consideradas

- **Devolver `regularPrice` / `compareAtPrice` extras no `ProductCardDTO`:** descartado nesta fase para manter fidelidade estrita ao contrato público especificado com `.strict()`. Pode ser evoluído de forma retrocompatível quando o SPA migrar.
- **Usar `published_at timestamptz` em vez de `status`:** descartado porque `status IN ('draft', 'published', 'archived')` cobre arquivamento explícito sem sobrecarga semântica e alinha com o backoffice futuro.
- **Fazer JOIN de `catalog.product_images` dentro de `MediaService`:** descartado para preservar a separação estrita de schemas do `ADR-0006`.

---

## Consequências

- **Positivas:** vazamentos de colunas internas falham imediatamente em testes; contratos são compartilháveis com o frontend via `@minieshop/contracts`; seed da Fase 1 continua funcionando sem alterações.
- **Trade-offs:** qualquer evolução de DTO exige atualização explícita no schema Zod em `packages/contracts` e no mapper correspondente.
