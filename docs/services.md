# Services & Data Layer Inventory (Incremental)

Tracks simulated API contracts (`src/services/`), domain types (`src/types/`), and mock datasets (`src/data/`).

---

## Simulated API Service (`src/services/api.ts`)

Exports `productsApi` (named and default export) backed by `PRODUCTS_MOCK`. Uses `DEFAULT_DELAY_MS = 300` and an internal `delay(ms, signal)` helper that rejects with `DOMException('The user aborted a request.', 'AbortError')` when aborted.

| Method | Parameters | Returns | Notes |
| :--- | :--- | :--- | :--- |
| `getProducts` | `GetProductsParams = {}` | `Promise<PaginatedProductsResponse>` | Supports `'price-asc'`, `'price-desc'`, `'rating'`, `'name'`; ignores category `'Todos'`; supports `AbortSignal` |
| `getProductById` | `(id: number \| string, delayMs?: number)` | `Promise<Product>` | Coerces `id` via `Number(id)`; throws `Error` if not found |
| `getCategories` | `(delayMs?: number)` | `Promise<string[]>` | Deduplicates categories from `PRODUCTS_MOCK` |
| `getRelatedProducts` | `(productId: number \| string, category: string, limit?: number, delayMs?: number)` | `Promise<Product[]>` | Filters same-category items excluding `productId`, backfills with other products if `< limit` |
| `searchProducts` | `SearchProductsParams = {}` | `Promise<Product[]>` | Matches `name`, `category`, or `description` (case-insensitive); supports `AbortSignal` |
| `validateStock` | `(productId: number \| string, requestedQuantity: number, signal?: AbortSignal)` | `Promise<StockValidationResult>` | `150ms` simulated delay; supports `AbortSignal`; defaults `maxStock` to `99` if non-numeric |

---

## Mock Product Dataset (`src/data/products.ts`)

Exports `PRODUCTS_MOCK: Product[]` (30 `RawProduct` entries in `RAW_PRODUCTS` transformed at module load).

### Transformation Pipeline per Product
1. `images`: `generateGalleryImages(product.image)` strips existing `&ar=` params and generates 4 aspect-ratio gallery URLs (`base`, `4:5`, `1:1`, `3:4`).
2. `specs`: `generateSpecs(product)` produces 8 `ProductSpec` rows (`Category`, `Model / SKU` formatted `MS-00001`, `Stock Status`, `Official Warranty`, `Shipping Estimate`, `Quality Standard`, `Packaging`, `Customer Satisfaction`).
3. `manufacturer`: `generateManufacturerInfo(product)` builds `ManufacturerInfo` (`{ brand, origin, warrantyText, sustainability, support }`).
4. `price`: `calculatePrice(product.price)` enriches `RawPriceInput` into `CalculatedPrice` (`regular_price`, `special_price`, `final_price`, `discount_percentage`, `has_discount`).
