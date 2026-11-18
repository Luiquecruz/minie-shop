# ADR-0004: Custom Hooks Facade and Abortable Frontend-Only Simulated API

- **Status:** Accepted
- **Date:** 2026-10-27
- **Phase:** Phase 3–5

## Context
During frontend-only phases, the app needs realistic async latency, search autocomplete, and stock validation without race conditions or tight coupling between UI components, Redux internals, and mock product data.

## Decision
- Centralize all catalog queries, search, related items, and stock validation in **`src/services/api.js`** (`productsApi`) over `PRODUCTS_MOCK`.
- Support **`AbortSignal`** cancellation in async helpers (`delay`, `getProducts`, `searchProducts`, `validateStock`).
- Provide custom hooks in `src/hooks/`:
  - `useFetch`: encapsulates debouncing (`300ms` default), `AbortController`, loading/error state, and `useEffect` cleanup.
  - `useCart` & `useCurrency`: act as facades over Redux Toolkit slices and formatting utilities so UI components stay decoupled from Redux boilerplate.

## Alternatives Considered
- **Direct `PRODUCTS_MOCK` imports in pages/components:** Rejected because synchronous access skips loading skeletons, error handling, and async cancellation patterns.
- **Third-party fetching libraries (TanStack Query / RTK Query):** Deferred to keep focus on core React `useEffect` cleanup and `AbortController` mechanics.

## Consequences
### Positive
- Replacing `productsApi` with real `fetch()` HTTP endpoints in a future phase requires minimal changes to pages and components.
- Eliminates out-of-order response bugs in `SearchBar` and `MiniCart` quantity validation.

### Negative / Trade-offs
- Simulated delays (`150ms`–`300ms`) add slight latency even on local mock data.

## Incremental Evolution Notes
If a real backend or RTK Query is introduced later, supersede this ADR and preserve the `productsApi` contract or migrate incrementally.
