# ADR-0018: Server-Side Multi-Currency Pricing, Progressive Cart Repricing, and Storefront i18n

- **Status:** Accepted
- **Date:** 2026-11-23
- **Phase:** Phase 6.1 (`SDD-0005`)

## Context

`ADR-0017` removed client-side currency conversion from `apps/storefront` to eliminate financial drift between displayed prices and authoritative backend pricing, temporarily hiding the `Navbar` currency selector and keeping `src/i18n/` as an English-only baseline.

To re-enable multi-currency (`BRL`, `USD`, `EUR`) and full bilingual storefront UX (`en`, `pt-BR`) without compromising financial integrity, HTTP caching, or React `<Profiler>` performance budgets, we need explicit contracts across PostgreSQL, NestJS, `@minieshop/contracts`, and `apps/storefront`.

## Decision

### 1. Database Pricing Model (`catalog.product_prices` + `catalog.exchange_rates`)
- **`catalog.product_prices`:** Stores explicit per-product currency overrides (`product_id`, `currency`, `regular_price_cents`, `special_price_cents`) with unique constraint `(product_id, currency)` and non-negative/special ≤ regular check constraints.
- **`catalog.exchange_rates`:** Stores deterministic server-side fallback rates from `BRL` (`currency` PK, `rate_from_brl NUMERIC(12,6) > 0`).
- **Resolution Rule:** For `BRL`, use `catalog.products` base prices. For `USD`/`EUR`, prefer `catalog.product_prices` override if present, otherwise compute `ROUND(base_cents * rate_from_brl)::integer` strictly on the server.

### 2. Query Parameter Currency Contract (`?currency=BRL|USD|EUR`)
- Public catalog endpoints (`GET /products`, `GET /products/facets`, `GET /products/:slug`) accept `?currency=BRL|USD|EUR` (default `BRL`).
- Using a query parameter instead of a custom header guarantees clean URL-keyed HTTP caching (`ETag` / CDN) without `Vary` fragmentation.
- `minPrice`, `maxPrice`, `facets.price`, `price_asc`, `price_desc`, and keyset pagination cursors (`cur` field in cursor payload) operate on the effective integer-cents price in the requested currency.

### 3. Authoritative Cart Quote (`POST /pricing/quote`) & Progressive Storefront Repricing
- Introduce `POST /pricing/quote` accepting `{ currency, productIds }` and returning exact item `MoneyDTO` prices, `inStock` flags, `freeShippingThresholdCents`, and `shippingOptions` for the requested currency.
- **Lazy + TTL Revalidation:** `Navbar` reads only `selectCartCount` (`useCartBadge`), keeping the badge instant with zero network requests while `MiniCart` is closed. `POST /pricing/quote` runs only when `MiniCart` is open or on `/cart`, triggered by currency mismatch or cart quote cache TTL expiration (`5 min`).
- **Pure Structural Sharing + Granular Shimmers:** `applyCartQuote` updates only changed cart items so unchanged sibling references and frozen `<Profiler>` benchmarks remain intact. Existing items remain visible while granular shimmer loaders cover only affected price and total blocks.

### 4. Independent Storefront i18n (`en` + `pt-BR`)
- Evolve `apps/storefront/src/i18n/` into `I18nProvider` + `useI18n()` with compile-time key parity (`en` default, `pt-BR`), persisted independently in `localStorage` (`minieshop_locale`), syncing `<html lang>` and `Intl.NumberFormat`.
- Catalog product names/descriptions remain API-sourced without introducing backend CMS translation tables in this phase.

## Consequences

### Positive
- Zero client-side FX conversion; server remains the single source of financial truth.
- Clean HTTP cacheability via `?currency=` query parameter and currency-scoped React Query keys.
- Instant Navbar badge and non-jarring progressive MiniCart/CartPage updates with granular shimmers.
- Frozen cart immutability, memoization, and `<Profiler>` tests remain green.

### Trade-offs
- Switching currency while having `minPrice`/`maxPrice` URL filters active clears those numeric bounds on the storefront so BRL bounds are not misapplied to USD/EUR.
- Catalog copy (product names/descriptions) remains in its seeded language until a future backend catalog localization phase.
