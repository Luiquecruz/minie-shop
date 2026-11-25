# Referência da API Pública do Catálogo (Fase 2)

Documentação de referência para integração do frontend e clientes HTTP com a API do **Progressive Minie Shop** (`http://localhost:3001`).

---

## 1. Convenções Gerais

- **Sem prefixo de versão** nas rotas públicas (`/categories`, `/products`, `/products/facets`, `/products/:slug`, `/favorites`, `/health`, `/ready`).
- **Valores monetários:** sempre em **centavos** (inteiro) + código ISO-4217 em `MoneyDTO`: `{ "amount": 29990, "currency": "BRL" }`. O campo `price` expõe o preço efetivo (`COALESCE(special_price_cents, regular_price_cents)`).
- **IDs:** UUID serializado como `string`.
- **Produtos publicados:** todas as rotas públicas filtram estritamente `catalog.products.status = 'published'` (migration `0006`). Produtos `draft` ou `archived` nunca aparecem na listagem, categorias, facetas, detalhe ou favoritos.
- **Contratos estritos:** todas as respostas passam por `Schema.parse` com `.strict()` em `@minieshop/contracts` (`packages/contracts/src/catalog/public.ts`). Campos internos do banco nunca vazam.
- **Imagens:** carregadas em lote pelo módulo `catalog` consultando `catalog.product_images` e chamando `MediaService.getReadyAssetsByIds(assetIds)` uma única vez por página (sem N+1 e sem leitura cross-schema). Imagens com `status !== 'ready'` contam como inexistentes (`image: null` no card; `images: []` no detalhe). Variantes vêm ordenadas por `width` crescente para uso direto em `srcset`.
- **CORS:** origens permitidas via `CORS_ORIGINS` (lista separada por vírgula; default `http://localhost:5199`, porta do dev server do SPA em `vite.config.ts`), com `credentials: true` e cabeçalhos `x-chaos-*` liberados no preflight.
- **Cache HTTP:**
  - `GET /categories`, `GET /products`, `GET /products/facets`, `GET /products/:slug`: `Cache-Control: public, max-age=30` + `ETag` fraco (`W/"..."`, com suporte a `If-None-Match` -> `304 Not Modified`).
  - `GET /favorites`, `POST /favorites/:productId`, `DELETE /favorites/:productId`: `Cache-Control: no-store`.
- **Rastreabilidade:** toda resposta inclui o cabeçalho `x-request-id` (reaproveitado do header enviado ou gerado como UUID).

---

## 2. Formato Padronizado de Erro

Todas as respostas de erro (validação, 404, caos, erro interno) seguem o mesmo envelope (`apiErrorResponseSchema`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "path": "limit",
        "message": "limit must be between 1 and 60"
      }
    ],
    "requestId": "9f8c7a6b-..."
  }
}
```

Códigos estáveis (`ErrorCode`):
- `VALIDATION_ERROR` (`400`) — parâmetros de query, path ou cursor inválidos (com `details` por campo).
- `NOT_FOUND` (`404`) — rota inexistente, produto não encontrado ou não publicado.
- `RATE_LIMITED` (`429`) — reservado para limitação de taxa.
- `CHAOS_FAILURE` (`503` ou status forçado) — erro simulado pelo middleware de caos em ambiente não-produtivo.
- `INTERNAL_ERROR` (`500`) — erro inesperado (sem stack trace na resposta; stack completo gravado no log estruturado com `requestId`).

---

## 3. Mapa de Rotas

| Método | Rota | Cache | Descrição |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | — | Liveness check (`{ status: "ok", timestamp }`) |
| `GET` | `/ready` | — | Readiness check com verificação do PostgreSQL |
| `GET` | `/categories` | `public, max-age=30` + `ETag` | Árvore de categorias com `productCount` acumulado |
| `GET` | `/products` | `public, max-age=30` + `ETag` | Listagem paginada por cursor com filtros, atributos e FTS |
| `GET` | `/products/facets` | `public, max-age=30` + `ETag` | Facetas disjuntivas (preço, categorias, atributos filtráveis) |
| `GET` | `/products/:slug` | `public, max-age=30` + `ETag` | Detalhe completo do produto com breadcrumbs e galeria |
| `GET` | `/favorites` | `no-store` | Lista de `productIds` favoritados (conta autenticada ou sessão anônima `anon_id`) |
| `POST` | `/favorites/:productId` | `no-store` | Adiciona produto aos favoritos (idempotente, `200`; exige `Origin` válido + `x-csrf-token` quando autenticado) |
| `DELETE` | `/favorites/:productId` | `no-store` | Remove produto dos favoritos (idempotente, `204`; exige `Origin` válido + `x-csrf-token` quando autenticado) |
| `GET` | `/search` | `public, max-age=30` + `ETag` | Busca híbrida/textual via Meilisearch com hidratação no Postgres e fallback em 3 camadas |
| `GET` | `/search/suggest` | `public, max-age=30` + `ETag` | Autocomplete lexical rápido (até 8 sugestões, sem embeddings) |
| `GET` | `/products/:slug/recommendations` | `public, max-age=30` + `ETag` | Recomendações pré-calculadas da PDP (`related`, `upsell`, `cross_sell`) hidratadas com estoque atual |
| `GET` | `/recommendations/cross-sell` | `public, max-age=30` + `ETag` | Cross-sell agregado para o carrinho a partir de `productIds` |
| `POST` | `/auth/register` | `no-store` | Cadastro anti-enumeração (`202` genérico, não cria sessão, enfileira e-mail de verificação) |
| `POST` | `/auth/login` | `no-store` | Login do cliente (define `sid_customer` / `__Host-sid_customer`, mescla favoritos de `anon_id` e limpa `anon_id`) |
| `POST` | `/auth/logout` | `no-store` | Encerra a sessão atual do cliente (`204`, exige `Origin` + `x-csrf-token`) |
| `POST` | `/auth/logout-all` | `no-store` | Encerra todas as sessões do cliente (`204`, exige `Origin` + `x-csrf-token`) |
| `GET` | `/auth/csrf` | `no-store` | Retorna token CSRF atrelado à sessão atual do cliente |
| `POST` | `/auth/verify-email` | `no-store` | Consome token assinado de verificação (24h, uso único) |
| `POST` | `/auth/resend-verification` | `no-store` | Reenvia verificação (`202` genérico, com rate limit) |
| `POST` | `/auth/forgot-password` | `no-store` | Inicia redefinição de senha (`202` genérico, com rate limit) |
| `POST` | `/auth/reset-password` | `no-store` | Consome token de redefinição (1h), troca senha e revoga todas as sessões |
| `POST` | `/auth/change-password` | `no-store` | Altera senha autenticada e revoga as demais sessões |
| `GET` / `PATCH` | `/me` | `no-store` | Lê ou atualiza perfil do cliente (`fullName`, `phone`) |
| `GET` / `POST` / `PATCH` / `DELETE` | `/me/addresses` (`/:id`) | `no-store` | CRUD de endereços do cliente (máx. 10, padrão único, posse com `404`) |
| `POST` | `/admin/auth/login` | `no-store` | Login do staff (define `sid_staff` / `__Host-sid_staff`, prazos curtos) |
| `POST` | `/admin/auth/logout` (`-all`) | `no-store` | Encerra sessão atual ou todas as sessões do staff (`204`) |
| `GET` | `/admin/auth/csrf` | `no-store` | Retorna token CSRF atrelado à sessão atual do staff |
| `GET` | `/admin/me` | `no-store` | Perfil, papéis e permissões do staff autenticado |
| `GET` | `/admin/customers` | `no-store` | Listagem paginada mínima de clientes (`customers:read`, auditada como `customers.listed`) |
| `GET` | `/admin/staff` | `no-store` | Listagem da equipe e papéis (`staff:manage`) |
| `PUT` | `/admin/staff/:id/roles` | `no-store` | Atualiza papéis do staff (`staff:manage`, proteção do último admin, auditada) |
| `GET` | `/admin/audit-log` | `no-store` | Consulta paginada por cursor da trilha de auditoria (`audit:read`) |

> **Ordem de rotas:** `/products/facets` é registrada antes de `/products/:slug`, e o slug `facets` é reservado tanto por constraint no banco (`products_slug_not_reserved`) quanto na validação do parâmetro `:slug`.

---

## 4. Detalhamento e Exemplos com `curl`

### 4.1 `GET /categories`

Retorna a árvore de categorias (`CategoryDTO[]`) ordenada por `sort_order ASC, name ASC`. `productCount` soma os produtos publicados da categoria e de todos os seus descendentes.

```bash
curl -s http://localhost:3001/categories | jq .

# Revalidação condicional via ETag (304 Not Modified)
ETAG=$(curl -sI http://localhost:3001/categories | awk -F': ' 'tolower($1)=="etag"{print $2}' | tr -d '\r')
curl -i -H "If-None-Match: $ETAG" http://localhost:3001/categories
```

---

### 4.2 `GET /products`

Parâmetros de query suportados (qualquer parâmetro desconhecido retorna `400 VALIDATION_ERROR`):

| Parâmetro | Tipo / Regra | Descrição |
| :--- | :--- | :--- |
| `category` | `string` (slug) | Filtra pela categoria e todos os seus descendentes |
| `minPrice` | inteiro `>= 0` (centavos) | Preço efetivo mínimo |
| `maxPrice` | inteiro `>= 0` (centavos) | Preço efetivo máximo (`minPrice <= maxPrice`) |
| `inStock` | `true \| false` | Usa a projeção `catalog.products.in_stock` (sem JOIN em `inventory`) |
| `q` | `string` | Busca textual `websearch_to_tsquery('portuguese', unaccent(q))` com índice GIN |
| `sort` | `newest` (default), `price_asc`, `price_desc`, `name_asc`, `relevance` | `relevance` só é permitido quando `q` está preenchido |
| `limit` | inteiro `1..60` (default `24`) | Tamanho da página |
| `cursor` | string opaca (`base64url`) | Cursor keyset devolvido em `nextCursor` |
| `attr.<code>` | lista separada por vírgula (`v1,v2`) | Para atributos `enum`, `string` e `boolean` com `is_filterable=true` (OR entre valores, AND entre atributos) |
| `attr.<code>.min` / `.max` | número | Para atributos `number` com `is_filterable=true` |

```bash
# Listagem com filtros combinados e busca sem acento
curl -s "http://localhost:3001/products?category=eletronicos&inStock=true&q=oculos&sort=relevance&limit=10" | jq .

# Filtro por atributos (booleano + faixa numérica)
curl -s "http://localhost:3001/products?attr.water_resistant=true&attr.battery_hours.min=10" | jq .

# Paginação por cursor (keyset)
PAGE1=$(curl -s "http://localhost:3001/products?sort=price_asc&limit=5")
echo "$PAGE1" | jq '.items | map({slug, price})'
NEXT=$(echo "$PAGE1" | jq -r '.nextCursor')
curl -s "http://localhost:3001/products?sort=price_asc&limit=5&cursor=${NEXT}" | jq '.items | map({slug, price})'
```

---

### 4.3 `GET /products/facets`

Aceita exatamente os mesmos filtros de `GET /products`, **exceto** `sort`, `limit` e `cursor` (que retornam `400`).
As facetas são **disjuntivas**: a contagem de cada faceta ignora o filtro da própria faceta, mas respeita todos os demais filtros ativos. Quando nenhum produto casa, `price` retorna `{ "min": null, "max": null }`.

```bash
# Facetas completas
curl -s "http://localhost:3001/products/facets" | jq .

# Facetas com categoria e atributo ativos (disjuntivas)
curl -s "http://localhost:3001/products/facets?category=eletronicos&attr.water_resistant=true" | jq .
```

---

### 4.4 `GET /products/:slug`

Retorna o `ProductDetailDTO` completo com `breadcrumbs` da raiz até a categoria do produto, todos os atributos definidos e `images` ordenadas por `is_primary DESC, position ASC` (`[]` se não houver imagem pronta).

```bash
curl -s http://localhost:3001/products/fone-de-ouvido-bluetooth-over-ear-pro | jq .

# Slug inexistente -> 404 padronizado
curl -i http://localhost:3001/products/produto-inexistente
```

---

### 4.5 Favoritos Anônimos (`GET/POST/DELETE /favorites`)

- Usa a tabela `catalog.favorites` indexada por `session_id`.
- Cria o cookie `anon_id` (UUID v4, assinado via `@fastify/cookie`, `HttpOnly`, `SameSite=Lax`, `Secure` em produção, `Max-Age=31536000` / 1 ano) **somente** nas rotas de favoritos e apenas se ainda não existir.
- `POST` e `DELETE` são estritamente idempotentes e retornam `404 NOT_FOUND` para produto inexistente ou não publicado.
- **Evolução futura (Auth):** na fase de autenticação (`identity`), os favoritos passam a ser associados ao cliente autenticado (`customer_id`), com mesclagem dos favoritos anônimos em tarefa dedicada.

```bash
# Adicionar favorito (cria cookie assinado anon_id em cookies.txt)
curl -i -c cookies.txt -X POST http://localhost:3001/favorites/<PRODUCT_UUID>

# Repetir POST (idempotente, sem duplicata)
curl -i -b cookies.txt -X POST http://localhost:3001/favorites/<PRODUCT_UUID>

# Listar favoritos da sessão
curl -s -b cookies.txt http://localhost:3001/favorites | jq .

# Remover favorito (idempotente, 204 No Content)
curl -i -b cookies.txt -X DELETE http://localhost:3001/favorites/<PRODUCT_UUID>
```

---

### 4.6 Busca Híbrida e Autocomplete (`GET /search` e `GET /search/suggest`)

O navegador **nunca** fala diretamente com o Meilisearch. Toda busca passa pela API, que consulta o motor, hidrata os `ProductCardDTO` a partir do PostgreSQL na ordem do motor (descartando produtos não publicados e exibindo preço/estoque atuais) e degrada em 3 camadas sempre com `HTTP 200` e campo `mode`:

1. `mode: "hybrid"` — Meilisearch com texto + vetor da consulta (embedder `userProvided` `semantic`, `768` dims, `SEARCH_SEMANTIC_RATIO`).
2. `mode: "keyword"` — Meilisearch apenas lexical (quando `mode=keyword` foi pedido ou o modelo de embeddings falhou/excedeu timeout).
3. `mode: "postgres"` — fallback para busca textual do PostgreSQL (quando o Meilisearch está indisponível ou o circuit breaker está aberto).

> **Atenção operacional:** alterar `EMBEDDINGS_DIMENSIONS` (atualmente `768`, `embeddinggemma`) exige atualizar a migration de `catalog.product_embeddings`, reexecutar `pnpm search:init`, `pnpm embeddings:reindex` e `pnpm search:reindex`.

Parâmetros de `GET /search`:
- `q` *(obrigatório)* — termo ou frase de busca.
- `limit` *(1..60, default `12`)*, `offset` *(0..200, default `0`)*.
- `category` *(slug)*, `minPrice`, `maxPrice` *(centavos)*, `inStock` *(`true | false`)*.
- `mode` *(`hybrid` default | `keyword`)*.

```bash
# Busca híbrida por intenção (profile ai ativo)
curl -s "http://localhost:3001/search?q=fone+para+viajar+de+aviao+sem+barulho" | jq '{mode, estimatedTotal, slugs: (.items | map(.slug))}'

# Busca somente textual (não gera embedding)
curl -s "http://localhost:3001/search?q=oculos&mode=keyword&limit=5" | jq .

# Autocomplete rápido (máx. 8 sugestões, sempre textual)
curl -s "http://localhost:3001/search/suggest?q=cafet" | jq .
```

---

### 4.7 Recomendações da PDP e do Carrinho (`GET /products/:slug/recommendations` e `GET /recommendations/cross-sell`)

As recomendações são **pré-calculadas** em `recommendations.product_relations` (sem kNN na requisição), sempre ordenadas com **curadoria manual primeiro** (`position ASC`) e depois **automáticas** (`score DESC`). Na leitura, a API faz sobrebusca no pool armazenado, hidrata os cards via `CatalogService` (somente `status = 'published'`, preço e estoque sempre atuais), descarta produtos sem estoque (`inStock = false`) e corta no limite pedido.

> **Convenção de chaves:** em `GET /products/:slug/recommendations`, as chaves do JSON seguem exatamente os valores do enum `type`, inclusive `cross_sell` (snake_case). Toda chave pedida em `types` está sempre presente na resposta (lista vazia `[]` quando não há recomendações elegíveis); nunca retorna erro por ausência de relações.

#### `GET /products/:slug/recommendations`
- `types` *(opcional, default `related,upsell,cross_sell`)* — lista separada por vírgula dos tipos desejados.
- `limit` *(opcional, inteiro `1..12`)* — sobrescreve o limite por tipo; quando omitido, usa defaults `related: 8`, `upsell: 4`, `cross_sell: 6`.
- `includeOutOfStock` *(opcional, `true | false`, default `false`)* — parâmetro de depuração para incluir itens sem estoque.
- Slug inexistente ou não publicado retorna `404 NOT_FOUND` padronizado.

#### `GET /recommendations/cross-sell`
- `productIds` *(obrigatório)* — lista separada por vírgula de `1..20` UUIDs. IDs já presentes na lista são excluídos da resposta; UUIDs válidos inexistentes ou despublicados são ignorados silenciosamente (resiliência de carrinho).
- `limit` *(opcional, inteiro `1..12`, default `6`)* — quantidade máxima de itens retornados em `{ "items": ProductCardDTO[] }`.
- `includeOutOfStock` *(opcional, `true | false`, default `false`)* — parâmetro de depuração.
- Ordenação: relações manuais primeiro (menor `position`), seguidas pela **soma dos scores** das relações `cross_sell` entre os produtos informados.

```bash
# Todas as listas da PDP (defaults: related=8, upsell=4, cross_sell=6)
curl -s "http://localhost:3001/products/fone-de-ouvido-bluetooth-over-ear-pro/recommendations" | jq '{related: (.related | map(.slug)), upsell: (.upsell | map(.slug)), cross_sell: (.cross_sell | map(.slug))}'

# Apenas related e upsell com limite 3
curl -s "http://localhost:3001/products/earbuds-tws-cancelamento-de-ruido/recommendations?types=related,upsell&limit=3" | jq .

# Depuração incluindo itens sem estoque
curl -s "http://localhost:3001/products/fone-de-ouvido-bluetooth-over-ear-pro/recommendations?includeOutOfStock=true" | jq .

# Cross-sell agregado para o carrinho (1 ou mais UUIDs)
curl -s "http://localhost:3001/recommendations/cross-sell?productIds=<UUID_1>,<UUID_2>&limit=6" | jq '.items | map(.slug)'
```

---

## 5. Middleware de Caos (somente não-produção)

Ativado apenas quando `CHAOS_ENABLED=true` **e** `NODE_ENV !== 'production'`.
Se `NODE_ENV=production` e `CHAOS_ENABLED=true`, o boot **falha** com mensagem explícita.
Quando ativo, um aviso `warn` é registrado no boot. As rotas `/health` e `/ready` são isentas.

| Cabeçalho | Formato | Comportamento |
| :--- | :--- | :--- |
| `x-chaos-delay` | Inteiro em ms (`500`) ou faixa (`200-800`), teto `10000` | Atraso artificial antes de processar a requisição |
| `x-chaos-fail` | Probabilidade entre `0` e `1` (`0.5`, `1`) | Retorna `503` com erro padronizado `CHAOS_FAILURE` |
| `x-chaos-status` | Status HTTP `400..599` (ex.: `429`, `502`) | Força o status HTTP informado com código `CHAOS_FAILURE` |

```bash
# Latência fixa de 400ms
curl -i -H "x-chaos-delay: 400" http://localhost:3001/categories

# Latência aleatória entre 150ms e 600ms
curl -i -H "x-chaos-delay: 150-600" http://localhost:3001/products

# Forçar 503 CHAOS_FAILURE
curl -i -H "x-chaos-fail: 1" http://localhost:3001/products

# Forçar status 429
curl -i -H "x-chaos-status: 429" http://localhost:3001/products
```

---

## 6. Planos de Consulta (`EXPLAIN ANALYZE` no Seed)

Planos coletados diretamente no PostgreSQL 17 (`pgvector/pgvector:pg17`) com o seed de 30 produtos:

### 6.1 Busca Textual (`q=oculos`, `sort=relevance`) — Uso do índice GIN confirmado

> Nota: com apenas 30 linhas, o planejador do PostgreSQL naturalmente prefere `Seq Scan`; com `SET LOCAL enable_seqscan = off` confirmamos que a expressão `search_vector @@ websearch_to_tsquery('portuguese', public.unaccent(...))` usa diretamente o índice GIN `products_search_vector_gin_idx` criado na T07:

```text
Limit  (cost=13.96..13.97 rows=4 width=57) (actual time=0.111..0.113 rows=4 loops=1)
  ->  Sort  (cost=13.96..13.97 rows=4 width=57) (actual time=0.110..0.111 rows=4 loops=1)
        Sort Key: (ts_rank(search_vector, websearch_to_tsquery('portuguese'::regconfig, unaccent('oculos'::text)))) DESC, id DESC
        Sort Method: quicksort  Memory: 25kB
        ->  Bitmap Heap Scan on products  (cost=8.83..13.92 rows=4 width=57) (actual time=0.056..0.075 rows=4 loops=1)
              Recheck Cond: (search_vector @@ websearch_to_tsquery('portuguese'::regconfig, unaccent('oculos'::text)))
              Filter: (status = 'published'::text)
              Heap Blocks: exact=3
              ->  Bitmap Index Scan on products_search_vector_gin_idx  (cost=0.00..8.83 rows=4 width=0) (actual time=0.036..0.036 rows=8 loops=1)
                    Index Cond: (search_vector @@ websearch_to_tsquery('portuguese'::regconfig, unaccent('oculos'::text)))
Planning Time: 3.566 ms
Execution Time: 0.162 ms
```

### 6.2 Listagem por Faixa de Preço com Ordenação Keyset (`price_asc`)

```text
Limit  (cost=3.53..3.54 rows=1 width=93) (actual time=0.048..0.052 rows=19 loops=1)
  ->  Sort  (cost=3.53..3.54 rows=1 width=93) (actual time=0.047..0.048 rows=19 loops=1)
        Sort Key: (COALESCE(special_price_cents, regular_price_cents)), id
        Sort Method: quicksort  Memory: 27kB
        ->  Seq Scan on products  (cost=0.00..3.52 rows=1 width=93) (actual time=0.012..0.029 rows=19 loops=1)
              Filter: ((COALESCE(special_price_cents, regular_price_cents) >= 10000) AND (COALESCE(special_price_cents, regular_price_cents) <= 50000) AND (status = 'published'::text))
              Rows Removed by Filter: 11
Planning Time: 0.215 ms
Execution Time: 0.068 ms
```

### 6.3 Filtro por Atributo JSONB (`attr.water_resistant=true`, `enable_seqscan=off`)

```text
Bitmap Heap Scan on products  (cost=8.36..11.89 rows=1 width=52) (actual time=0.030..0.050 rows=3 loops=1)
  Recheck Cond: (status = 'published'::text)
  Filter: ((attributes ->> 'water_resistant'::text) = 'true'::text)
  Rows Removed by Filter: 27
  Heap Blocks: exact=3
  ->  Bitmap Index Scan on products_status_idx  (cost=0.00..8.36 rows=30 width=0) (actual time=0.010..0.010 rows=60 loops=1)
        Index Cond: (status = 'published'::text)
Planning Time: 0.080 ms
Execution Time: 0.062 ms
```

---

## 7. Decisões de Contrato

Ver [`ADR-0008`](./adr/0008-contratos-api-publica-erros-e-status-produto.md) e [`ADR-0009`](./adr/0009-vitest-testes-integracao-api-e-banco-isolado.md) para o histórico completo das decisões desta fase.

---

## 8. Lacunas e Inconsistências de Contrato Observadas na Fase 7 (API Inalterada)

Durante a integração da UI de busca (`S08`) e recomendações (`R05`) no storefront sem modificações no código da API (`apps/api`), foram identificadas e contornadas as seguintes lacunas nos contratos públicos atuais:

1. **Ausência de `?currency=` em busca e recomendações:** Os schemas de query de `GET /search`, `GET /search/suggest`, `GET /products/:slug/recommendations` e `GET /recommendations/cross-sell` utilizam `.strict()` e não aceitam `currency`, retornando `ProductCardDTO` com preços fixos em `BRL`. O storefront **não** envia `?currency=` para esses endpoints (para evitar `400 VALIDATION_ERROR`), exibe a moeda exatamente conforme retornada (`BRL`) no `PriceBox` e confia em `useCartQuoteSync` (`POST /pricing/quote`) para reprecificar na moeda selecionada após a adição ao carrinho.
2. **Ausência de `categorySlug` em `GET /search/suggest`:** Cada item de sugestão retorna `{ slug, name, categoryName }` sem `categorySlug`, enquanto a rota canônica da PDP no storefront é `/:category/:slug`. O componente `SearchBar` resolve o slug da categoria buscando correspondência no cache de categorias do React Query (`queryKeys.categories.all`) com fallback para `slugifyFallback(categoryName)` (ou `catalog`). A navegação permanece segura mesmo com cache frio porque a `ProductDetailPage` carrega o produto exclusivamente por `slug` (`useProductQuery(slug)`) e redireciona qualquer segmento de categoria divergente para a URL canônica `/${product.category.slug}/${product.slug}` via `<Navigate replace />`.
3. **Ausência de limite `max` explícito no campo `q` em `searchPublicQuerySchema`:** O contrato do servidor valida apenas `.trim().min(1)` em `/search` e `/search/suggest`; o storefront aplica teto defensivo de `200` caracteres (`MAX_SEARCH_QUERY_LENGTH`) tanto na validação Zod do parâmetro `?q=` quanto nos inputs de busca.
