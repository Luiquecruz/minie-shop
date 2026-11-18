# Utilities Inventory (Incremental)

Tracks pure business logic modules in `src/utils/`.

---

## Summary Table

| Module | Path | Exports | Purpose |
| :--- | :--- | :--- | :--- |
| `currency.ts` | `src/utils/currency.ts` | `SUPPORTED_CURRENCIES`, `DEFAULT_CURRENCY`, `isCurrencyCode`, `convertCurrency`, `formatCurrencyWithCode` | Multi-currency rates, runtime type guard & `Intl.NumberFormat` formatting |
| `price.ts` | `src/utils/price.ts` | `calculatePrice`, `formatCurrency` | Discount precedence & price normalization |

---

## Module Details

### `src/utils/currency.ts`
- **`DEFAULT_CURRENCY: CurrencyCode`:** `'BRL'`
- **`SUPPORTED_CURRENCIES: Record<CurrencyCode, CurrencyConfig>`:**
  - `BRL`: `{ code: 'BRL', label: 'BRL (R$)', symbol: 'R$', rate: 1.0, locale: 'pt-BR' }`
  - `USD`: `{ code: 'USD', label: 'USD ($)', symbol: '$', rate: 0.18, locale: 'en-US' }`
  - `EUR`: `{ code: 'EUR', label: 'EUR (€)', symbol: '€', rate: 0.16, locale: 'de-DE' }`
- **`isCurrencyCode(value: string): value is CurrencyCode`:**
  - Type guard verifying whether a string key exists in `SUPPORTED_CURRENCIES`.
- **`convertCurrency(valueInBrl: number, targetCurrency: CurrencyCode = 'BRL'): number`:**
  - Guards non-number / `Number.isNaN` inputs returning `0`.
  - Falls back to `BRL` if `targetCurrency` is unsupported.
  - Multiplies `valueInBrl * config.rate`.
- **`formatCurrencyWithCode(valueInBrl: number, targetCurrency: CurrencyCode = 'BRL'): string`:**
  - Guards non-number / `Number.isNaN` inputs returning `'R$ 0,00'`.
  - Converts value and formats with `new Intl.NumberFormat(config.locale, { style: 'currency', currency: config.code })`.

### `src/utils/price.ts`
- **`formatCurrency(value: number, currency: CurrencyCode = 'BRL'): string`:** Thin wrapper delegating to `formatCurrencyWithCode`.
- **`calculatePrice(rawPrice: RawPriceInput | number = {}): CalculatedPrice`:**
  - Supports backward compatibility when `rawPrice` is passed as a primitive `number` (`has_discount: false`, `special_price: null`, `discount_percentage: 0`).
  - Parses `regular_price` and `special_price`.
  - Discount applies (`has_discount = true`) only when `specialPrice` is a valid number `> 0` and `< regularPrice`.
  - Computes `final_price = hasDiscount && specialPrice !== null ? specialPrice : regularPrice` and `discount_percentage = Math.round(((regularPrice - finalPrice) / regularPrice) * 100)`.
