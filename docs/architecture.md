# Arquitetura do Sistema — Progressive Minie Shop

Visão arquitetural completa do monorepo (`apps/storefront`, `apps/api`, `packages/contracts`, `packages/config`, `packages/email` e `infra/`).

---

## 1. Módulos do Backend (`apps/api`)

A API segue o estilo de **monolito modular** (`ADR-0002`), com fronteiras verificadas por `eslint-plugin-boundaries` (cada módulo expõe apenas `index.ts`) e isolamento de persistência com um schema PostgreSQL por domínio (`ADR-0006`):

```mermaid
flowchart LR
  subgraph Entrypoints["Entrypoints (apps/api)"]
    HTTP["HTTP API\nNestJS + Fastify\n:3001"]
    WORKER["Worker Process\nOutbox Polling\n:3002/health"]
  end

  subgraph Modules["Módulos de Domínio (fronteiras via index.ts)"]
    CAT["catalog\n(schema: catalog)\nCategorias, Produtos, Facetas, Favoritos"]
    MED["media\n(schema: media)\nSharp WebP, variantes, S3"]
    INV["inventory\n(schema: inventory)\nEstoque por variante"]
    SRC["search\nSearchPort -> Meilisearch\nFallback 3 camadas"]
    REC["recommendations\n(schema: recommendations)\nRelacionados, Upsell, Cross-sell"]
    IDN["identity\n(schema: identity)\nSessões opacas, CSRF, RBAC, Perfil"]
    PLT["platform\n(schema: platform)\nOutbox, Audit Log, E-mail"]
  end

  subgraph Shared["Pacotes Compartilhados"]
    CTR["@minieshop/contracts\nZod .strict()"]
    EML["@minieshop/email\nReact Email"]
  end

  HTTP --> CAT
  HTTP --> SRC
  HTTP --> REC
  HTTP --> IDN
  HTTP --> PLT
  CAT --> MED
  CAT --> INV
  SRC --> CAT
  REC --> CAT
  IDN --> CAT
  IDN --> PLT
  WORKER --> PLT
  WORKER --> SRC
  WORKER --> REC
  PLT --> EML
  Modules -.-> CTR
```

---

## 2. Fluxo Assíncrono: Outbox → Worker → Índice / Recomendações / E-mail

Mutações de catálogo, mídia e identidade gravam eventos na tabela `platform.outbox_events` na **mesma transação ACID** do PostgreSQL (`ADR-0012`). O processo `worker` consome eventos com `SELECT ... FOR UPDATE SKIP LOCKED`, retentativas com backoff e dead-letter:

```mermaid
sequenceDiagram
  participant API as API / Seed
  participant PG as PostgreSQL (Domínio + platform.outbox_events)
  participant WRK as Worker (Outbox Consumers)
  participant OLL as Ollama (profile: ai)
  participant MS as Meilisearch
  participant MP as Mailpit / Resend

  API->>PG: BEGIN; grava mutação + INSERT outbox_events; COMMIT
  loop Polling com SKIP LOCKED
    WRK->>PG: Busca eventos pendentes por consumer
    alt Consumer: search-index
      WRK->>PG: Hidrata documento + embedding (se existir)
      WRK->>MS: Upsert/Delete documento no índice products
    else Consumer: embeddings (profile ai)
      WRK->>OLL: Gera vetor (768 dims)
      WRK->>PG: Persiste em catalog.product_embeddings (pgvector)
    else Consumer: recommendations
      WRK->>PG: Recalcula related / upsell / cross_sell
    else Consumer: email
      WRK->>MP: Envia verificação / reset de senha (React Email)
    end
    WRK->>PG: Marca evento como processado (ou agenda retry/DLQ)
  end
```

---

## 3. Fluxo Storefront → API (`apps/storefront`)

O storefront separa rigorosamente **estado de servidor** (TanStack React Query) de **estado local/cliente** (Redux Toolkit para o carrinho e `useSearchParams` da URL para filtros):

```mermaid
flowchart TD
  URL["URL SearchParams\n(?category, q, minPrice, maxPrice, inStock, sort, attr.*)"] <-->|"Zod parse/serialize\n(push / replace)"| PLP["ProductListingPage\n(useInfiniteQuery + Facets)"]
  PLP -->|"Link /:category/:slug"| PDP["ProductDetailPage\n(useProductQuery + Galeria + Atributos)"]
  PLP --> Cart["CartPage (/cart) & MiniCart\n(Redux Toolkit cartSlice + createSelector)"]
  PDP --> Cart

  PLP --> RQ["TanStack QueryClient\n(staleTime explícito, keepPreviousData,\nsem retry em 4xx)"]
  PDP --> RQ
  Cart -->|"Validação inStock"| RQ

  RQ --> Repo["ProductRepository (Contexto React)\nHttpProductRepository | MockProductRepository"]
  Repo --> HTTP["httpClient\n(env Zod, credentials: include,\nAbortSignal, timeout, x-chaos-* só DEV)"]
  HTTP -->|"Parse tolerante (.strip)"| Contracts["@minieshop/contracts/catalog/client"]
  HTTP -->|"HTTP :3001 (same-site localhost)"| API["apps/api (NestJS + Fastify)"]
  API -->|"ImageDTO (variants + placeholder)"| Img["ProductImage\n(srcset, sizes, aspect-ratio,\nfallback SVG inline por estado)"]
  Cart --> LS["localStorage versionado (v2)\n(createListenerMiddleware)"]
```

---

## 4. Camadas e Fronteiras do Storefront

- **Domínio (`src/domain/`):** interface `ProductRepository` e tipos derivados de `@minieshop/contracts`.
- **Infraestrutura (`src/infrastructure/`):** `httpClient`, mapeamento de erros (`ApiError`, `NetworkError`, `ContractViolationError`), `HttpProductRepository`, `MockProductRepository` e leitura DEV-only de cabeçalhos de caos (`x-chaos-*`).
- **Estado de Servidor (`src/query/`, `src/hooks/useProducts.ts`, `src/hooks/useFavorites.ts`):** `useInfiniteQuery` para cursor pagination, `useQuery` para categorias/facetas/PDP/favoritos e `useMutation` otimista para favoritos com rollback.
- **Estado de Cliente (`src/store/`, `src/hooks/useCart.ts`):** Redux Toolkit `cartSlice` (imutável), `createSelector` memoizado, `cartStorage.ts` versionado (v2) com `createListenerMiddleware`, e cálculos 100% em centavos inteiros.
- **UI e Resiliência (`src/components/`, `src/pages/`):** `ProductImage` com fallback SVG inline (ADR-0005), `CatalogFilters` acessível (`fieldset`/`legend` + `aria-live="polite"`), `formatMoney` na borda de exibição e camada base de i18n (`src/i18n/`).

---

## 5. Governança de Decisões (ADRs)

Todas as decisões arquiteturais do projeto estão registradas de forma incremental em [`docs/adr/README.md`](./adr/README.md) (`ADR-0001` até `ADR-0017`).
