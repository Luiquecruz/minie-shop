# `@minieshop/storefront`

React + TypeScript storefront for **Progressive Minie Shop**, integrated with `@minieshop/api` via `@minieshop/contracts` tolerant client schemas (`.strip()`), TanStack React Query, React Router, Redux Toolkit (frozen cart slice), and React InstantSearch (lazy-loaded on `/search`).

## Routes

| Route | Component | Loading Strategy | Highlights |
| :--- | :--- | :--- | :--- |
| `/` | `ProductListingPage` | Eager (entry chunk) | URL-synced catalog filters (`category`, `q`, `minPrice`, `maxPrice`, `inStock`, `sort`, `attr.*`), infinite pagination, optimistic favorites |
| `/search` | `SearchResultsPage` | Lazy (`React.lazy`) | Dedicated InstantSearch results route (`?q=` Zod-synced, `hitsPerPage=24`, `offset <= 200` cutoff, DEV telemetry badge) |
| `/:category/:slug` | `ProductDetailPage` | Eager | Product gallery, attributes, sticky CTA, `IntersectionObserver` lazy `related` + `upsell` carousels |
| `/cart` | `CartPage` | Eager | Redux Toolkit pure cart, `POST /pricing/quote` repricing, cross-sell carousel with inline silent Add to Cart |
| `/product/:id` | `LegacyProductRedirect` | Eager | Redirects legacy numeric product URLs to `/:category/:slug` |

## Architecture Highlights

- **Single HTTP Transport:** `src/infrastructure/http/httpClient.ts` handles Zod env config (`VITE_API_URL`), `credentials: 'include'`, timeouts, `AbortSignal`, `ApiError`/`NetworkError`/`ContractViolationError`, and DEV chaos headers (`chaos.delay`, `chaos.fail`, `chaos.status` in `localStorage`).
- **Search Split (`ADR-0019`, `ADR-0020`):**
  - Header `SearchBar` uses proprietary WAI-ARIA APG `useCombobox` (`role="combobox"`, `aria-activedescendant`, `role="listbox"`, `aria-live="polite"`) + React Query (`useSearchSuggestQuery`, 200 ms debounce, min 2 trimmed chars, max 8 suggestions) — hidden on `/search`.
  - `/search` loads `react-instantsearch@7.55.1` lazily via `React.lazy`, keeping InstantSearch completely out of the `/` and PDP entry chunks.
- **Recommendations (`ADR-0021`):**
  - `RecommendationCarousel` uses native CSS horizontal scroll-snap (`overscroll-behavior-x: contain`, `prefers-reduced-motion` support, focus redirection when boundary Prev/Next buttons disable, horizontal focus-into-view, zero-CLS loading skeletons, silent collapse on empty/errors).
  - PDP fetches `related` and `upsell` once on intersection (`rootMargin: '200px 0px'`). Cart queries cross-sell for up to 20 most recent distinct item IDs via `selectRecentCartProductIds`.

## Scripts

```bash
pnpm --filter @minieshop/storefront dev        # Start Vite dev server (http://localhost:5199)
pnpm --filter @minieshop/storefront build      # Strict tsc --noEmit && vite build
pnpm --filter @minieshop/storefront preview    # Serve production dist/
pnpm --filter @minieshop/storefront lint       # Oxlint across all files
pnpm --filter @minieshop/storefront typecheck  # Strict TypeScript check
pnpm --filter @minieshop/storefront test       # Vitest + RTL + vitest-axe suites
pnpm --filter @minieshop/storefront test:watch # Vitest watch mode
pnpm --filter @minieshop/storefront metrics    # Playwright benchmark (metrics/run-metrics.mjs)
```

## Environment Variables

Validated at boot via Zod in `src/config/env.ts`:

- `VITE_API_URL` (required in dev/build): API origin without trailing slash (e.g., `http://localhost:3001`). Falls back to `http://localhost:3001` in `MODE === 'test'`.
