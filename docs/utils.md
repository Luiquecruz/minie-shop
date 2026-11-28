# Utilities Inventory (Incremental)

Tracks pure, framework-agnostic utility modules under `apps/storefront/src/utils/`.

*(Note: Legacy `src/utils/price.ts` and client-side FX conversion helpers were deleted as part of the server-authoritative pricing policy (`ADR-0017`, `ADR-0018`) and pre-Design System dead-code cleanup.)*

---

## Summary Table

| Module | Path | Exports | Purpose |
| :--- | :--- | :--- | :--- |
| `cn.ts` | `apps/storefront/src/utils/cn.ts` | `cn` | Conditional class name composition & Tailwind CSS v4 utility conflict resolution (`clsx` + `tailwind-merge`) |
| `currency.ts` | `apps/storefront/src/utils/currency.ts` | `SUPPORTED_CURRENCIES`, `SUPPORTED_CURRENCY_LIST`, `DEFAULT_CURRENCY`, `isCurrencyCode` | Display metadata and runtime type guard for supported ISO-4217 currencies (`BRL`, `USD`, `EUR`) — zero client FX rates |
| `money.ts` | `apps/storefront/src/utils/money.ts` | `formatMoney`, `formatCents` | Integer-cents `MoneyDTO` formatting via `Intl.NumberFormat` at the UI display boundary |
| `catalogUrlParams.ts` | `apps/storefront/src/utils/catalogUrlParams.ts` | `CatalogUrlState`, `parseCatalogUrlParams`, `serializeCatalogUrlParams`, `hasActiveCatalogFilters` | Zod-validated parsing and canonical serialization of PLP filter/sort `URLSearchParams` |
| `searchUrlParams.ts` | `apps/storefront/src/utils/searchUrlParams.ts` | `MAX_SEARCH_QUERY_LENGTH`, `searchQueryParamSchema`, `parseSearchUrlQuery`, `serializeSearchUrlQuery` | Zod-validated parsing, trimming, and length capping (`200` chars) of `/search?q=` |

---

## Module Details

### `apps/storefront/src/utils/cn.ts`
- **`cn(...inputs: ClassValue[]): string`:** Wraps `twMerge(clsx(inputs))` so conditional Tailwind v4 utility classes resolve predictably without specificity clashes (`ADR-0024`).

### `apps/storefront/src/utils/currency.ts`
- **`DEFAULT_CURRENCY: CurrencyCode`:** `'BRL'`
- **`SUPPORTED_CURRENCIES: Record<CurrencyCode, CurrencyConfig>`:**
  - `BRL`: `{ code: 'BRL', label: 'BRL (R$)', symbol: 'R$', locale: 'pt-BR' }`
  - `USD`: `{ code: 'USD', label: 'USD ($)', symbol: '$', locale: 'en-US' }`
  - `EUR`: `{ code: 'EUR', label: 'EUR (€)', symbol: '€', locale: 'de-DE' }`
- **`isCurrencyCode(value: string): value is CurrencyCode`:** Strict runtime type guard accepting only `'BRL' | 'USD' | 'EUR'`.

### `apps/storefront/src/utils/money.ts`
- **`formatMoney(money: MoneyDTO, locale = 'pt-BR'): string`:** Truncates finite integer cents safely (`safeCents / 100`) and formats with `Intl.NumberFormat(locale, { style: 'currency', currency })`. Never performs currency conversion.
- **`formatCents(amountCents: number, currency = 'BRL', locale = 'pt-BR'): string`:** Convenience wrapper over `formatMoney`.

### `apps/storefront/src/utils/catalogUrlParams.ts`
- **`parseCatalogUrlParams(searchParams: URLSearchParams): CatalogUrlState`:** Validates `category`, `q`, `minPrice`, `maxPrice`, `inStock`, `sort` (`productSortSchema`), `attr.<code>`, and `attr.<code>.{min,max}` using Zod; drops inverted `min > max` ranges cleanly without throwing.
- **`serializeCatalogUrlParams(state: CatalogUrlState): URLSearchParams`:** Produces canonical sorted query parameters matching backend API parameter names.
- **`hasActiveCatalogFilters(state: CatalogUrlState): boolean`:** Reports whether any non-default catalog filter is active.

### `apps/storefront/src/utils/searchUrlParams.ts`
- **`parseSearchUrlQuery(searchParams: URLSearchParams): string`:** Trims and caps `?q=` to `MAX_SEARCH_QUERY_LENGTH` (`200`).
- **`serializeSearchUrlQuery(query: string): URLSearchParams`:** Serializes a normalized non-empty query into `?q=`.
