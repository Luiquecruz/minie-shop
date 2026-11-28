# Services & Data Layer Inventory (Incremental)

Tracks storefront domain ports, HTTP transport, repositories, query-string builders, tolerant client contracts (`@minieshop/contracts/*/client`), and the React InstantSearch adapter under `apps/storefront/src/{domain,infrastructure,context}/`.

*(Note: The Phase 1–5 frontend-only simulated `src/services/api.ts` and `src/data/products.ts` were retired in Phase 6 (`ADR-0017`) and replaced by the real NestJS API + `ProductRepository` architecture below.)*

---

## 1. Domain Layer (`apps/storefront/src/domain/`)

Framework-free contracts and helpers enforced by Oxlint (`domain/` cannot import React or `infrastructure/`):

- **`ProductRepository` (`src/domain/repositories/ProductRepository.ts`):** Repository interface implemented by `HttpProductRepository` and `MockProductRepository`, defining domain limits (`MAX_SEARCH_LIMIT = 60`, `SEARCH_PAGE_SIZE = 24`, `MAX_SEARCH_OFFSET = 200`, `MAX_SUGGEST_LIMIT = 8`, `MAX_CROSS_SELL_PRODUCT_IDS = 20`, `MAX_RECOMMENDATION_LIMIT = 24`) and typed query/response methods:
  - `getCategories(signal?)`
  - `getProducts(params, signal?)` (cursor-paginated `GET /products`)
  - `getFacets(params, signal?)` (`GET /products/facets`)
  - `getProductBySlug(slug, currency?, signal?)` (`GET /products/:slug`)
  - `getFavorites(signal?)` (`GET /favorites`)
  - `addFavorite(productId, signal?)` (`POST /favorites/:productId`)
  - `removeFavorite(productId, signal?)` (`DELETE /favorites/:productId`)
  - `quoteCart(request, signal?)` (`POST /pricing/quote`)
  - `searchProducts(params, signal?)` (`GET /search` with `?currency=`)
  - `suggestProducts(params, signal?)` (`GET /search/suggest` returning `categorySlug`)
  - `getProductRecommendations(params, signal?)` (`GET /products/:slug/recommendations`)
  - `getCrossSell(params, signal?)` (`GET /recommendations/cross-sell`)
- **`errors.ts` (`src/domain/errors.ts`):** Pure type guards (`isNotFoundError`, `getErrorCode`, `getErrorStatus`) so presentation layers inspect error semantics without importing `infrastructure/http/errors`.

---

## 2. Infrastructure Layer (`apps/storefront/src/infrastructure/`)

- **HTTP Transport (`src/infrastructure/http/httpClient.ts`):**
  - Validates `VITE_API_URL` at boot via Zod (`src/config/env.ts`).
  - Sends `credentials: 'include'`, propagates caller `AbortSignal`, enforces per-request timeouts, and injects DEV-only `x-chaos-delay` / `x-chaos-fail` headers (tree-shaken in production).
  - **CSRF Bootstrap & Retry:** Automatically fetches and caches the CSRF token (`GET /auth/csrf`), attaches `x-csrf-token` on state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`), performs a single refresh-and-retry on `403` CSRF errors, and wraps shared token-refresh awaits in `awaitWithAbortSignal` so caller aborts cancel immediately without aborting sibling callers.
  - Maps HTTP/network/schema failures into typed `ApiError`, `NetworkError`, and `ContractViolationError` (`src/infrastructure/http/errors.ts`).
  - Validates all responses using tolerant `.strip()` client schemas from `@minieshop/contracts/{catalog,search,recommendations,identity}/client`.
- **Query String Builders (`src/infrastructure/repositories/queryStrings.ts`):**
  - Houses all HTTP `URLSearchParams` encoders (`buildProductsQueryString`, `buildFacetsQueryString`, `buildSearchQueryString`, `buildSuggestQueryString`, `buildRecommendationsQueryString`, `buildCrossSellQueryString`) outside `domain/`, including `?currency=` support on `/search`.
- **Repositories (`src/infrastructure/repositories/`):**
  - `HttpProductRepository.ts`: Production repository instantiated in the composition root (`apps/storefront/src/main.tsx`) and injected via `ProductRepositoryProvider`.
  - `MockProductRepository.ts`: Deterministic in-memory test/offline twin backed by `src/test/fixtures/catalogFixture.ts`, supporting `hybrid`/`keyword`/`postgres` search simulation and failure modes.
  - `productRepositoryContract.test.ts`: Shared contract test suite verifying behavioral parity between `HttpProductRepository` and `MockProductRepository`.
- **Search Client Adapter (`src/infrastructure/search/instantSearchAdapter.ts`):**
  - `createStorefrontSearchClient(repository, currency)` bridges `react-instantsearch` pagination (`page`, `hitsPerPage = 24`) to `ProductRepository.searchProducts`, short-circuiting empty queries and `offset > 200` without network requests. Exposed to UI components via `useStorefrontSearchClient()` in `src/hooks/useSearch.ts`.

---

## 3. Composition Root & Context (`src/main.tsx`, `src/context/`)

- `productRepositoryContext.ts` holds only the `ProductRepository` port type (zero concrete `HttpProductRepository` import).
- `main.tsx` instantiates the default `HttpProductRepository` and passes it to `<ProductRepositoryProvider repository={repository}>`, while Vitest suites inject `new MockProductRepository()`.
