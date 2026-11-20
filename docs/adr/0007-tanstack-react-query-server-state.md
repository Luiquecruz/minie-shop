# ADR-0007: TanStack React Query for Server & Async Data State

- **Status:** Accepted
- **Date:** 2026-11-20
- **Phase:** Post-Phase 5 / Pre-Phase 6 Milestone
- **Related SDD:** [`docs/sdd/0004-tanstack-react-query-migration.md`](../sdd/0004-tanstack-react-query-migration.md)
- **Supersedes (Partially):** [`ADR-0004`](./0004-custom-hooks-and-abortable-simulated-api.md)

## Context
Under [ADR-0004](./0004-custom-hooks-and-abortable-simulated-api.md), `ProductListingPage`, `ProductDetailPage`, `SearchBar`, and `MiniCart` handled asynchronous calls through manual `useEffect` hooks and a custom `useFetch` hook (`src/hooks/useFetch.ts`). While that approach demonstrated `AbortController` cleanup and debouncing, it lacked:
- Cross-route query caching (navigating from Catalog to PDP and back re-fetched the entire product list unnecessarily).
- Non-flickering paginated transitions (`keepPreviousData`).
- Standardized retry with exponential backoff and smart error differentiation.
- Optimistic updates with automatic cache rollback for mutations (such as product favorites).

Meanwhile, Redux Toolkit (`cart` and `currency` slices under [ADR-0003](./0003-redux-toolkit-with-localstorage-persistence.md)) remains ideal for persistent client UI state.

## Decision
- Adopt **`@tanstack/react-query`** as the single server/async state layer across the application, paired with **`@tanstack/react-query-devtools`** rendered only in development (`import.meta.env.DEV`, `buttonPosition="bottom-right"`).
- Keep **Redux Toolkit** strictly for synchronous/persisted client state (`cart` and `currency`), preserving the clean separation between client state (Redux) and server/async cache (React Query).
- Configure a singleton `QueryClient` in `src/query/queryClient.ts`:
  - `staleTime`: `2 * 60 * 1000` (2 minutes) for catalog, PDP, related products, and favorites; `5 * 60 * 1000` (5 minutes) for categories; `60 * 1000` for search autocomplete; `30 * 1000` for cart stock validation.
  - `gcTime`: `10 * 60 * 1000` (10 minutes).
  - `refetchOnWindowFocus`: `false`.
  - `retry`: Smart retry predicate that skips retries for `ProductNotFoundError` and retries transient/simulated API failures up to `2` times with capped exponential backoff (`Math.min(1000 * 2 ** attemptIndex, 4000)`).
- Centralize all query keys in a strongly-typed factory (`src/query/queryKeys.ts`) and expose domain hooks in `src/hooks/useProducts.ts`, `src/hooks/useFavorites.ts`, and `src/hooks/useDebounce.ts`.
- Remove `src/hooks/useFetch.ts` once all async consumers (`ProductListingPage`, `ProductDetailPage`, `SearchBar`, `MiniCart`) are migrated to React Query.
- Extend `src/services/api.ts` (`productsApi`) so every query method accepts `AbortSignal` (enabling React Query automatic request cancellation) and add an observable `apiErrorSimulator` controlled by a discreet bottom-left `ApiDebugFab` component for verifying retries, error UIs, and optimistic mutation rollbacks.

## Alternatives Considered
- **RTK Query:** Rejected because introducing React Query explicitly fulfills the architectural goal of dedicated cache, `staleTime`, `keepPreviousData`, and optimistic mutation patterns with minimal Redux coupling.
- **Migrating only Catalog and PDP while keeping `useFetch` in `SearchBar`:** Rejected because keeping two competing async fetching abstractions increases maintenance surface and forfeits shared search caching and retry behavior.

## Consequences
### Positive
- Returning from PDP to Catalog serves cached pages immediately with zero redundant requests while preserving URL-synced filters (`?page=&category=&sort=`).
- Pagination switches smoothly without skeleton flicker using `placeholderData: keepPreviousData`.
- Favorite toggles update UI instantaneously via `onMutate` optimistic cache updates and roll back deterministically on simulated failure.
- Consistent loading, error, and manual retry flows across every async surface.

### Negative / Trade-offs
- Adds `@tanstack/react-query` to the runtime bundle and `@tanstack/react-query-devtools` as a devDependency.
- Requires keeping query key invalidations aligned whenever new mutations are added in Phase 6 (Cart/Checkout).

## Incremental Evolution Notes
When `productsApi` transitions from `PRODUCTS_MOCK` to real HTTP endpoints, all query keys, `AbortSignal` propagation, retry predicates, and optimistic mutation contracts remain unchanged.
