# Services & Data Layer Inventory (Incremental)

Tracks simulated API contracts (`src/services/`) and mock datasets (`src/data/`).

---

## Simulated API Service (`src/services/api.js`)

Exports `productsApi` (named and default export) backed by `PRODUCTS_MOCK`. Uses `DEFAULT_DELAY_MS = 300` and an internal `delay(ms, signal)` helper that rejects with `DOMException('The user aborted a request.', 'AbortError')` when aborted.

| Method | Parameters | Returns | Notes |
| :--- | :--- | :--- | :--- |
| `getProducts` | `{ category, search, sortBy, page, limit, signal, delayMs = 300 }` | `Promise<{ products, total, page?, totalPages? }>` | Supports `'price-asc'`, `'price-desc'`, `'rating'`, `'name'`; ignores category `'Todos'`; supports `AbortSignal` |
| `getProductById` | `(id, delayMs = 300)` | `Promise<Object>` | Coerces `id` via `Number(id)`; throws `Error` if not found |
| `getCategories` | `(delayMs = 300)` | `Promise<string[]>` | Deduplicates categories from `PRODUCTS_MOCK` |
| `getRelatedProducts` | `(productId, category, limit = 4, delayMs = 300)` | `Promise<Array>` | Filters same-category items excluding `productId`, backfills with other products if `< limit` |
| `searchProducts` | `{ query = '', limit = 6, signal, delayMs = 200 }` | `Promise<Array>` | Matches `name`, `category`, or `description` (case-insensitive); supports `AbortSignal` |
| `validateStock` | `(productId, requestedQuantity, signal)` | `Promise<{ available, maxStock, message }>` | `150ms` simulated delay; supports `AbortSignal`; defaults `maxStock` to `99` if non-numeric |

---

## Mock Product Dataset (`src/data/products.js`)

Exports `PRODUCTS_MOCK` (30 products in `RAW_PRODUCTS` transformed at module load).

### Transformation Pipeline per Product
1. `images`: `generateGalleryImages(product.image)` strips existing `&ar=` params and generates 4 aspect-ratio gallery URLs (`base`, `4:5`, `1:1`, `3:4`).
2. `specs`: `generateSpecs(product)` produces 8 key-value specification rows (`Category`, `Model / SKU` formatted `MS-00001`, `Stock Status`, `Official Warranty`, `Shipping Estimate`, `Quality Standard`, `Packaging`, `Customer Satisfaction`).
3. `manufacturer`: `generateManufacturerInfo(product)` builds `{ brand, origin, warrantyText, sustainability, support }`.
4. `price`: `calculatePrice(product.price)` enriches `{ regular_price, special_price }` with `final_price`, `discount_percentage`, and `has_discount`.
