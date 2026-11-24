# SDD-0005: Multi-Currency Server Pricing & Full Storefront i18n (Phase 6.1)

- **Status:** In Progress (PR 1: Multi-Currency Pricing; PR 2: Storefront i18n)
- **Phase:** Phase 6.1 (Extraordinary Milestone)
- **Related ADRs:** [ADR-0017](../adr/0017-camada-dados-storefront-repositorio-cursor-rotas.md), [ADR-0018](../adr/0018-multicurrency-pricing-and-storefront-i18n.md)
- **Branches:**
  - PR 1: `feat/multicurrency-pricing`
  - PR 2: `feat/storefront-i18n`

---

## 1. Context & Goal

In Phase 6 (`ADR-0017`), the storefront removed client-side currency conversion math and hid the `Navbar` currency selector to guarantee financial parity with the backend, while introducing a lightweight English-only `i18n` base.

Phase 6.1 completes both deferred capabilities across two focused Pull Requests (each strictly ≤ 100 changed files):

1. **Server-Side Multi-Currency Pricing (`BRL`, `USD`, `EUR`):**
   - Explicit per-product currency overrides (`catalog.product_prices`) with deterministic integer-cents server-side fallback via `catalog.exchange_rates`.
   - Query parameter `?currency=BRL|USD|EUR` (default `BRL`) across `GET /products`, `GET /products/facets`, and `GET /products/:slug`, with price filters (`minPrice`, `maxPrice`), facets (`facets.price`), sorting (`price_asc`, `price_desc`), and cursor pagination operating on effective prices in the requested currency.
   - Server cart quote endpoint `POST /pricing/quote` returning exact product prices, stock availability, shipping options, and free-shipping threshold in the requested currency.
   - Storefront `Navbar` currency selector (`BRL` / `USD` / `EUR`) with progressive, lazy + TTL-based cart/MiniCart repricing and granular price/total shimmer loaders.
2. **Full Storefront i18n (`en` + `pt-BR`):**
   - Reactive `I18nProvider` + `useI18n()` covering all storefront UI chrome (`Navbar`, `PLP`, `PDP`, `CatalogFilters`, `MiniCart`, `CartPage`, `404`, `<Helmet>`), `<html lang>`, and `Intl.NumberFormat` locale formatting.
   - Independent compact language selector (`EN` / `PT-BR`) in `Navbar` persisted in `localStorage` (`minieshop_locale`).

---

## 2. Functional Requirements

### 2.1 Backend Multi-Currency Pricing (PR 1)
- Supported ISO-4217 currencies: `BRL` (default), `USD`, `EUR`. Invalid values return `400 VALIDATION_ERROR`.
- Price resolution precedence per product & currency:
  1. If `currency === 'BRL'`: `COALESCE(products.special_price_cents, products.regular_price_cents)`.
  2. Otherwise, if a row exists in `catalog.product_prices` for `(product_id, currency)`: `COALESCE(product_prices.special_price_cents, product_prices.regular_price_cents)`.
  3. Otherwise, deterministic integer-cents fallback: `ROUND(COALESCE(products.special_price_cents, products.regular_price_cents) * exchange_rates.rate_from_brl)::integer`.
- `POST /pricing/quote` accepts `{ currency, productIds }` (up to 100 UUIDs) and returns `{ currency, items: [{ productId, price, inStock }], freeShippingThresholdCents, shippingOptions }`.

### 2.2 Storefront Currency & Progressive Cart Repricing (PR 1)
- **Zero client-side FX conversion:** The storefront never multiplies prices by exchange rates; it formats exact `MoneyDTO` values returned by the API.
- **Navbar Badge Isolation:** `Navbar` subscribes only to `selectCartCount` (`useCartBadge`), keeping the badge instant from local Redux state with zero network requests while the `MiniCart` is closed.
- **Lazy & TTL-Based Quote Revalidation:** `POST /pricing/quote` runs only when `items.length > 0` AND (`MiniCart` is open OR user is on `/cart`), triggered on currency mismatch or cart quote cache TTL expiration (`5 min`).
- **Granular Shimmer Loaders:** Existing cart items remain visible during repricing; shimmer skeletons render strictly over affected price blocks and totals/shipping blocks.
- **Guardrails:** Quantity edits remain optimistic; `inStock: false` displays a non-destructive item warning; quote failures show an inline error + Retry action and disable Checkout while currency mismatches persist.
- **Frozen Tests Preservation:** All existing `cartSlice`, `cartSelectors`, and `CartPage.profiler.test.tsx` tests pass without regression (`16` Profiler updates).

### 2.3 Full Storefront i18n (PR 2)
- Supported locales: `en` (default) and `pt-BR`, persisted in `localStorage` (`minieshop_locale`), independent of `minieshop_currency`.
- Strict compile-time key parity (`Record<MessageKey, string>`).
- Sync `<html lang>` and `Intl.NumberFormat` locale dynamically.

---

## 3. Acceptance Criteria

- [ ] `GET /products?currency=USD|EUR` applies explicit `product_prices` overrides and `exchange_rates` fallback accurately.
- [ ] `minPrice`, `maxPrice`, `facets.price`, `price_asc`, `price_desc`, and cursor pagination operate on effective currency cents.
- [ ] `POST /pricing/quote` returns authoritative item prices, stock flags, and currency-denominated shipping options.
- [ ] Switching currency with `MiniCart` closed makes zero `/pricing/quote` calls; opening `MiniCart` or visiting `/cart` triggers progressive repricing with granular shimmers.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm --filter @minieshop/storefront test`, and `pnpm --filter @minieshop/api test:integration` pass.
- [ ] Both PRs contain ≤ 100 changed files.
