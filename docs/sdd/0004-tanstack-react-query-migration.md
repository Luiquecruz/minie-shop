# SDD-0004: TanStack React Query Migration & Optimistic Favorites

- **Status:** In Progress
- **Phase:** Post-Phase 5 / Pre-Phase 6 Milestone
- **Author:** Antigravity
- **Date:** 2026-11-20
- **Related ADRs:** [`docs/adr/0007-tanstack-react-query-server-state.md`](../adr/0007-tanstack-react-query-server-state.md), [`docs/adr/0004-custom-hooks-and-abortable-simulated-api.md`](../adr/0004-custom-hooks-and-abortable-simulated-api.md)

---

## 1. Problem Statement & Goal
Manual `useEffect` data fetching in `ProductListingPage` and `ProductDetailPage`, manual `AbortController` timers in `MiniCart`, and the custom `useFetch` hook in `SearchBar` lack cross-route caching, stale-time management, non-flickering pagination transitions, automatic/manual retry coordination, and optimistic mutation rollback.

This specification defines the complete migration of all asynchronous server/catalog flows to **TanStack React Query (`@tanstack/react-query`)**, starting from the Catalog (PLP) and Product Detail Page (PDP), extending to `SearchBar` and `MiniCart` stock validation, removing `src/hooks/useFetch.ts`, and adding an optimistic-update **Favorites** mutation alongside an `ApiDebugFab` error simulator.

## 2. Scope
### In Scope
- Install `@tanstack/react-query` and `@tanstack/react-query-devtools` (dev-only).
- Configure `QueryClient` (`src/query/queryClient.ts`) and centralized `queryKeys` (`src/query/queryKeys.ts`).
- Migrate `ProductListingPage`, `ProductDetailPage`, `SearchBar`, and `MiniCart` stock validation to React Query hooks (`src/hooks/useProducts.ts`, `src/hooks/useFavorites.ts`, `src/hooks/useDebounce.ts`) and delete `src/hooks/useFetch.ts`.
- Add URL-synchronized (`?page=&category=&sort=`) numbered pagination (`12` items/page) to `ProductListingPage` using `placeholderData: keepPreviousData` so page transitions do not flash skeletons.
- Implement `toggleFavorite` optimistic mutation with `localStorage` persistence (`minieshop_favorites`), rollback on error, heart SVG buttons on `ProductCard` and `ProductDetailPage`, and a `"Favorites"` filter chip in `ProductListingPage`.
- Add `apiErrorSimulator` in `src/services/api.ts` and a discreet bottom-left `ApiDebugFab` component in `RootLayout` to simulate query and favorite mutation failures and invalidate caches.
- Add `AbortSignal` support across all `productsApi` query methods and `ProductNotFoundError` for 404 vs. transient error handling.

### Out of Scope
- Real backend HTTP endpoints or authentication.
- Dedicated Cart & Checkout pages (reserved for `SDD-0001`).
- Automated test runner installation (reserved for `SDD-0002`).

## 3. Functional Requirements
1. **FR-1 — Query Client & Cache Policy:** Configure `QueryClient` with `staleTime: 2 * 60 * 1000`, `gcTime: 10 * 60 * 1000`, `refetchOnWindowFocus: false`, and smart `retry` (`2` retries with exponential backoff for transient/simulated errors; `0` retries for `ProductNotFoundError`).
2. **FR-2 — Zero Unnecessary Refetch on Back Navigation:** Returning from `/product/:id` to `/` (including filtered/paginated URLs such as `/?page=2&category=Electronics`) must read cached query results immediately within `staleTime` without showing loading skeletons or triggering a new API call.
3. **FR-3 — Non-Flickering URL-Synced Pagination:** `ProductListingPage` must paginate products (`12` per page) using `useSearchParams` (`page`, `category`, `sort`) and `placeholderData: keepPreviousData`, keeping previously rendered cards visible while the next page fetches.
4. **FR-4 — PDP Dependent Queries & Error Recovery:** `ProductDetailPage` must fetch the product detail (`useProductQuery`) and dependent related products (`useRelatedProductsQuery`) via React Query, distinguishing `ProductNotFoundError` ("Product Not Found") from transient API errors (offering a **"Try Again"** button wired to `refetch()`).
5. **FR-5 — SearchBar & MiniCart Migration:** `SearchBar` must use `useDebounce` + `useProductSearchQuery` (including inline error + retry UI inside the dropdown) and `MiniCart` item quantity validation must use `useDebounce` + `useStockValidationQuery`. `src/hooks/useFetch.ts` must be removed.
6. **FR-6 — Optimistic Favorites Mutation & Rollback:** Users can toggle favorites via a heart SVG button on `ProductCard` and `ProductDetailPage` and filter by `"Favorites"` on `ProductListingPage`. `useToggleFavoriteMutation` must optimistically update `queryKeys.favorites.all` in `onMutate`, reconcile each settled toggle against confirmed IDs while retaining pending toggles, and invalidate favorite product lists in `onSettled`. Refetch favorite IDs once no toggles are pending.
7. **FR-7 — Simulated Error Controls (`ApiDebugFab`):** A discreet FAB in the bottom-left corner lets developers/testers toggle **Simulate Query Error**, **Simulate Favorite Error**, and trigger **Invalidate Cache** (`queryClient.invalidateQueries()`).

## 4. UI, Accessibility & Dark Mode Requirements
- All new UI (`Pagination`, `ApiDebugFab`, favorite heart buttons, error/retry banners) must use CSS custom properties from `src/index.css` supporting both Light and Dark modes.
- Zero emojis in UI; use crisp inline vector SVGs (`aria-hidden="true"` for decorative icons).
- Accessible controls:
  - Favorite toggle buttons use `aria-pressed={isFavorite}` and descriptive `aria-label`.
  - Pagination uses `<nav aria-label="Catalog pagination">` with `aria-current="page"` on the active page button and `disabled` states on boundary arrows.
  - `ApiDebugFab` popover uses `aria-expanded`, `aria-controls`, and keyboard `Escape` dismissal, positioned at `bottom-left` so it never overlaps `ReactQueryDevtools` (`bottom-right`).
  - On PDP mobile/desktop where `.pdp-floating-bar` is visible, `ApiDebugFab` sits cleanly above or clear of obstructions and remains accessible on mobile (`<= 640px`).

## 5. Architecture & Contracts
### Affected Files / Modules
- `package.json`
- `src/main.tsx`
- `src/query/queryKeys.ts`, `src/query/queryClient.ts`
- `src/types/api.ts`
- `src/services/api.ts`
- `src/hooks/useDebounce.ts`, `src/hooks/useProducts.ts`, `src/hooks/useFavorites.ts`
- Delete `src/hooks/useFetch.ts`
- `src/components/Pagination/Pagination.tsx`, `Pagination.css`
- `src/components/ApiDebugFab/ApiDebugFab.tsx`, `ApiDebugFab.css`
- `src/components/ProductCard/ProductCard.tsx`, `ProductCard.css`
- `src/components/SearchBar/SearchBar.tsx`, `SearchBar.css`
- `src/components/MiniCart/MiniCart.tsx`
- `src/layouts/RootLayout/RootLayout.tsx`
- `src/pages/ProductListingPage/ProductListingPage.tsx`, `ProductListingPage.css`
- `src/pages/ProductDetailPage/ProductDetailPage.tsx`, `ProductDetailPage.css`

### State & API Contracts
- `productsApi.getProducts(params: GetProductsParams): Promise<PaginatedProductsResponse>` supports `favoritesOnly?: boolean` and `signal?: AbortSignal`.
- `productsApi.getProductById(id, delayMs?, signal?)`, `productsApi.getCategories(delayMs?, signal?)`, `productsApi.getRelatedProducts(productId, category, limit?, delayMs?, signal?)` accept `AbortSignal`.
- `productsApi.getFavorites(delayMs?: number, signal?: AbortSignal): Promise<number[]>` and `productsApi.toggleFavorite(productId: number): Promise<number[]>` persist favorite IDs in `localStorage` under `'minieshop_favorites'`.
- `apiErrorSimulator` exposes `getSnapshot()`, `subscribe(listener)`, `setFailQueries(enabled)`, `setFailFavoritesMutation(enabled)`, and `reset()`.

## 6. Edge Cases & Guardrails
- **Out-of-bounds page parameter:** If `?page=99` exceeds `totalPages` (e.g., after changing category or unfavoriting the last item on page 2), clamp or reset to a valid page cleanly without showing a broken empty screen when items exist.
- **Invalid `?page=` parameter:** Non-numeric or `<= 0` page params fall back to `1`.
- **Disabled / failing `localStorage`:** Wrap `localStorage` reads/writes in `typeof window !== 'undefined'` and `try/catch` with in-memory fallback.
- **Abort propagation:** All `queryFn` callbacks forward React Query's `{ signal }` to `productsApi`.
- **No `any` types:** Strict TypeScript (`tsc --noEmit`) and Oxlint (`typescript/no-explicit-any: error`) compliance across all new and edited files.

## 7. Acceptance Criteria
- [ ] `useFetch.ts` is removed and all async calls (PLP, PDP, SearchBar, MiniCart) run through React Query.
- [ ] Returning from PDP to Catalog preserves `?page=&category=&sort=` and serves cached results without unnecessary refetches.
- [ ] Paginating between pages keeps previous items rendered without skeleton flicker (`keepPreviousData`).
- [ ] Favoriting/unfavoriting updates optimistically on both `ProductCard` and `ProductDetailPage`, persists across reloads, filters correctly via the `"Favorites"` chip, and rolls back when **Simulate Favorite Error** is active.
- [ ] Enabling **Simulate Query Error** triggers React Query retries, displays error UI with **"Try Again"**, and recovers cleanly when disabled and retried.
- [ ] `npm run typecheck`, `npm run lint`, and `npm run build` pass with 0 errors and 0 warnings.
- [ ] Browser flow validated in Light & Dark modes across desktop and mobile viewports.
- [ ] `docs/` inventories and `AGENTS.md` updated.

## 8. Verification Plan
1. Run `npm run typecheck && npm run lint && npm run build`.
2. Start `npm run dev` and inspect in Chrome:
   - Navigate Catalog pages 1 -> 2 -> 3 (no flicker), open a product PDP, press Back -> verify instant cached Catalog page 2.
   - Toggle Favorites on PLP & PDP, filter by `"Favorites"`, reload page -> verify persistence.
   - Toggle **Simulate Favorite Error** in `ApiDebugFab`, click heart -> verify optimistic toggle followed by rollback and error toast.
   - Toggle **Simulate Query Error** in `ApiDebugFab`, click **Invalidate Cache** -> verify automatic retry attempts in React Query Devtools, error screen with **"Try Again"**, disable error simulation, click **"Try Again"** -> verify recovery.
   - Verify `SearchBar` autocomplete & error retry and `MiniCart` debounced stock validation.
   - Verify Light & Dark modes and mobile layout (`390x844`).
