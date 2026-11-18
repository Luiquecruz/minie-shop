# Utilities Inventory (Incremental)

Tracks pure business logic modules in `src/utils/`.

---

## Summary Table

| Module | Path | Exports | Purpose |
| :--- | :--- | :--- | :--- |
| `currency.js` | `src/utils/currency.js` | `SUPPORTED_CURRENCIES`, `DEFAULT_CURRENCY`, `convertCurrency`, `formatCurrencyWithCode` | Multi-currency rates & `Intl.NumberFormat` formatting |
| `price.js` | `src/utils/price.js` | `calculatePrice`, `formatCurrency` | Discount precedence & price normalization |

---

## Module Details

### `src/utils/currency.js`
- **`DEFAULT_CURRENCY`:** `'BRL'`
- **`SUPPORTED_CURRENCIES`:**
  - `BRL`: `{ code: 'BRL', label: 'BRL (R$)', symbol: 'R$', rate: 1.0, locale: 'pt-BR' }`
  - `USD`: `{ code: 'USD', label: 'USD ($)', symbol: '$', rate: 0.18, locale: 'en-US' }`
  - `EUR`: `{ code: 'EUR', label: 'EUR (€)', symbol: '€', rate: 0.16, locale: 'de-DE' }`
- **`convertCurrency(valueInBrl, targetCurrency = 'BRL')`:**
  - Guards non-number / `NaN` inputs returning `0`.
  - Falls back to `BRL` if `targetCurrency` is unsupported.
  - Multiplies `valueInBrl * config.rate`.
- **`formatCurrencyWithCode(valueInBrl, targetCurrency = 'BRL')`:**
  - Guards non-number / `NaN` inputs returning `'R$ 0,00'`.
  - Converts value and formats with `new Intl.NumberFormat(config.locale, { style: 'currency', currency: config.code })`.

### `src/utils/price.js`
- **`formatCurrency(value, currency = 'BRL')`:** Thin wrapper delegating to `formatCurrencyWithCode`.
- **`calculatePrice(rawPrice = {})`:**
  - Supports backward compatibility when `rawPrice` is passed as a primitive `number` (`has_discount: false`, `special_price: null`, `discount_percentage: 0`).
  - Parses `regular_price` and `special_price`.
  - Discount applies (`has_discount = true`) only when `specialPrice` is a valid number `> 0` and `< regularPrice`.
  - Computes `final_price = hasDiscount ? specialPrice : regularPrice` and `discount_percentage = Math.round(((regularPrice - finalPrice) / regularPrice) * 100)`.
