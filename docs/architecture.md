# System Architecture — Progressive Minie Shop

End-to-end architectural overview of the **react-minieshop** monorepo (`apps/storefront`, `apps/api`, `packages/ui`, `packages/contracts`, `packages/config`, `packages/email`, and `infra/`).

---

## 1. Backend Modular Monolith (`apps/api`)

The API follows a **modular monolith** architecture (`ADR-0002`, `ADR-0023`) with NestJS 11 + Fastify 5 and Drizzle ORM `0.45.4`. Module boundaries and per-schema database ownership are statically enforced by `eslint-plugin-boundaries` in `apps/api/eslint.config.mjs`—each module exposes only `index.ts` and writes strictly to its own PostgreSQL schema (`ADR-0006`).

```mermaid
flowchart LR
  subgraph Entrypoints["Entrypoints (apps/api)"]
    HTTP["HTTP API\nNestJS + Fastify\n:3001"]
    WORKER["Worker Process\nOutbox Polling\n:3002/health"]
  end

  subgraph Modules["Domain Modules (boundaries via index.ts)"]
    CAT["catalog\n(schema: catalog)\nCategories, Products, Facets, Favorites, Image Links"]
    MED["media\n(schema: media)\nSharp WebP, variants, S3"]
    INV["inventory\n(schema: inventory)\nVariant stock items"]
    SRC["search\nSearchPort -> Meilisearch\n3-tier fallback + ?currency="]
    REC["recommendations\n(schema: recommendations)\nRelated, Upsell, Cross-sell"]
    IDN["identity\n(schema: identity)\nOpaque sessions, CSRF, RBAC, Profile"]
    PLT["platform\n(schema: platform)\nOutbox, Audit Log, Mailer"]
  end

  subgraph Shared["Workspace Packages"]
    CFG["@minieshop/config\ntsconfig.{base,node,web}, ESLint, Prettier"]
    CTR["@minieshop/contracts\nZod v4 (.strict server / .strip client)"]
    EML["@minieshop/email\nReact Email"]
    UI["@minieshop/ui\nCSS-first light-dark() tokens & RSC-safe ESM"]
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
  Modules -.-> CFG
```

### Key Hardening Guarantees
- **Output Contract Masking:** `parseOutput()` validates responses against `.strict()` server schemas; contract violations log structured details server-side in `GlobalExceptionFilter` and return a generic `500 INTERNAL_ERROR` envelope without leaking internal field paths.
- **Last-Admin Protection:** `StaffAdminService` filters `isActive = true` when enforcing last-admin and sole `staff:manage` invariants.
- **Production Container Image:** `apps/api/Dockerfile` separates `development` (Compose) from a compiled `production` stage (`node dist/main.js`) packaging `dist` and `drizzle` migrations only.

---

## 2. Asynchronous Outbox Flow: Outbox -> Worker -> Search / Recommendations / Email

Domain mutations record events in `platform.outbox_events` inside the **same PostgreSQL ACID transaction** (`ADR-0012`), including `EmbeddingsOutboxHandler` upserting vectors and enqueueing `product.embedding_updated` atomically. The `worker` entrypoint claims batches with `SELECT ... FOR UPDATE SKIP LOCKED`, leases, exponential backoff + jitter, and dead-letter handling:

```mermaid
sequenceDiagram
  participant API as API / Seed
  participant PG as PostgreSQL 17 (Domain + platform.outbox_events)
  participant WRK as Worker (Outbox Consumers)
  participant OLL as Ollama (embeddinggemma-2)
  participant MS as Meilisearch
  participant MP as Mailpit / Resend

  API->>PG: BEGIN; domain write + INSERT outbox_events; COMMIT
  loop Polling with SKIP LOCKED
    WRK->>PG: Claim pending rows per consumer
    alt Consumer: search-index
      WRK->>PG: Hydrate product document + embedding vector
      WRK->>MS: Upsert/Delete document in products index
    else Consumer: embeddings (profile: ai)
      WRK->>OLL: Generate 768-dim vector (embeddinggemma-2)
      WRK->>PG: BEGIN; upsert catalog.product_embeddings + enqueue product.embedding_updated; COMMIT
    else Consumer: recommendations
      WRK->>PG: Rebuild related / upsell / cross_sell scores
    else Consumer: mailer
      WRK->>MP: Send verification / password reset email (React Email)
    end
    WRK->>PG: Mark processed (or schedule retry / dead-letter)
  end
```

---

## 3. Storefront -> API Data Flow (`apps/storefront`)

The storefront separates **server state** (TanStack React Query), **URL state** (`useSearchParams` parsed/serialized with Zod), and **pure client state** (Redux Toolkit slices persisted via `createListenerMiddleware`), styled with **Tailwind CSS v4** (`ADR-0024`):

```mermaid
flowchart TD
  URL["URL SearchParams\n(?category, q, minPrice, maxPrice, inStock, sort, attr.*)"] <-->|"Zod parse/serialize"| PLP["ProductListingPage\n(useInfiniteQuery + CatalogFilters)"]
  NAV["Navbar (Theme Toggle + i18n + Currency + SearchBar)\n(useCombobox APG + 200ms debounce)"] -->|"Enter / See all -> ?q="| SRP["SearchResultsPage (/search, React.lazy + ErrorBoundary)\n(react-instantsearch + offset <= 200)"]
  NAV -->|"Select suggestion -> /:category/:slug"| PDP
  PLP -->|"Link /:category/:slug"| PDP["ProductDetailPage\n(useProductQuery + APG Tabs + Full-width Lazy Recs)"]
  PDP -->|"IntersectionObserver (200px)\ntypes=related,upsell"| RC["RecommendationCarousel\n(scroll-snap + CLS = 0)"]
  PLP --> Cart["CartPage (/cart) & MiniCart (<dialog>)\n(Frozen cartSlice + Inline Cross-Sell)"]
  PDP --> Cart

  PLP --> RQ["TanStack QueryClient\n(staleTime, keepPreviousData, no 4xx retry)"]
  NAV -->|"GET /search/suggest"| RQ
  PDP --> RQ
  SRP -->|"useStorefrontSearchClient"| Repo
  Cart -->|"Stock validation + POST /pricing/quote + Cross-Sell"| RQ

  RQ --> Repo["ProductRepository (Composition-root DI in main.tsx)\nHttpProductRepository | MockProductRepository"]
  Repo --> HTTP["HttpClient\n(Zod env, credentials: include, CSRF bootstrap/retry,\nAbortSignal, timeout, DEV-only x-chaos-*)"]
  HTTP -->|"Tolerant parse (.strip)"| Contracts["@minieshop/contracts/*/client"]
  HTTP -->|"HTTP :3001"| API["apps/api (NestJS + Fastify)"]
  API -->|"ImageDTO (variants + placeholder)"| Img["ProductImage\n(srcset, sizes, aspect-ratio, inline SVG fallback)"]
  Cart --> LS["Versioned localStorage (v2)\n(createListenerMiddleware)"]
```

---

## 4. Storefront Layer Boundaries (Enforced by Oxlint)

`apps/storefront/.oxlintrc.json` enforces `jsx-a11y`, `import/no-cycle`, and directional layer imports (`no-restricted-imports`):

- **Domain (`src/domain/`):** `ProductRepository` port and framework-free domain error helpers (`errors.ts`). Cannot import React or `infrastructure/`.
- **Infrastructure (`src/infrastructure/`):** `HttpClient` (CSRF token cache/retry with `awaitWithAbortSignal`, `AbortSignal`, DEV-only chaos), `HttpProductRepository`, `MockProductRepository`, `queryStrings.ts`, and `instantSearchAdapter.ts`.
- **Composition Root & Context (`src/main.tsx`, `src/context/`):** Instantiates `HttpProductRepository` at app boot and injects it via `ProductRepositoryProvider` (zero concrete infrastructure import inside `context/`).
- **Hooks & Server State (`src/query/`, `src/hooks/`):** Domain facades (`useCart`, `useCartActions`, `useCurrency`, `useTheme`, `useFavorites`, `useProducts`, `useSearch`, `useRecommendations`, `useCombobox`, `useInView`, `useDevChaos`, `useDebounce`).
- **Client State (`src/store/`):** Pure `cartSlice` (frozen in Phase 7) and pure `currencySlice`, memoized `createSelector` derivations (`cartSelectors.ts`), and `createListenerMiddleware` persistence (`cartStorage.ts`, `currencyStorage.ts`, including `applyCartQuote` persistence).
- **UI, Accessibility & Styling (`src/layouts/`, `src/components/`, `src/pages/`, `src/index.css`):** Single `<main id="main-content">` + Skip Link in `RootLayout`, route & lazy-chunk `<ErrorBoundary>`, native `<dialog>` `MiniCart`, WAI-ARIA APG keyboard controls (`SearchBar`, `Dropdown`, PDP `Tabs`), and unified Tailwind CSS v4 semantic utilities backed by `@minieshop/ui/styles.css` (`light-dark()` tokens, `Baseline 2024+`, `html[data-theme]`, zero legacy `.css` files, `ADR-0024`, `ADR-0025`).

---

## 5. Architecture Decision Records

All incremental architectural decisions are recorded in [`docs/adr/README.md`](./adr/README.md) (`ADR-0001` through `ADR-0025`).
