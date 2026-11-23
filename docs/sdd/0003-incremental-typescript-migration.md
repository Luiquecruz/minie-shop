# SDD-0003: Incremental TypeScript Migration (File-by-File)

- **Status:** Implemented
- **Phase:** Pre-Phase 6 Milestone (Executed ahead of Phase 6 Cart & Checkout)
- **Author:** Antigravity
- **Date:** 2026-11-18
- **Related ADRs:** [`ADR-0001`](../adr/0001-frontend-architecture-baseline.md) *(consolidates former ADRs `0001`, `0006`)*

---

## 1. Problem Statement & Goal

**Progressive Minie Shop** was built in JavaScript (`.js` / `.jsx`) through Phases 1–5 to focus on React patterns, routing, Redux Toolkit state, and asynchronous UI workflows. Executing the TypeScript migration **now — immediately before Phase 6 (Cart Page & Checkout Flow)** — ensures all existing modules have compile-time safety and enables Phase 6 to be authored directly in strict TypeScript.

The goal of this specification is to define a **two-phase, file-by-file TypeScript migration** that keeps the application buildable and runnable at every intermediate step, progresses bottom-up from domain utilities to route pages, introduces generics and discriminated unions for asynchronous state, and finishes with strict compiler enforcement (`"strict": true`, `"allowJs": false`, zero `any`, clean `tsc --noEmit`).

---

## 2. Scope

### In Scope
- Installing `typescript` in `devDependencies` and configuring `tsconfig.json` (app) + `tsconfig.node.json` (`vite.config.ts`).
- Adding Vite client ambient types (`src/vite-env.d.ts`) and updating `index.html` entry point (`/src/main.jsx` -> `/src/main.tsx`).
- Updating `package.json` scripts (`"typecheck": "tsc --noEmit"`, `"build": "tsc --noEmit && vite build"`) and `.oxlintrc.json` (`typescript` plugin with `"typescript/no-explicit-any": "error"`).
- Standardizing on **extensionless imports** (e.g., `'../../hooks/useCart'`) with `"moduleResolution": "bundler"` as files are migrated.
- **Migration Phase 1 (Foundation, Coexistence & Bottom-Up File Conversion):**
  - Enabling `allowJs: true` (with `strict: false` initially) so `.js/.jsx` and `.ts/.tsx` coexist during file-by-file transition.
  - Defining shared domain `type` aliases and `interface` contracts in `src/types/` (`currency.ts`, `product.ts`, `cart.ts`, `api.ts`, `index.ts`).
  - Renaming and typing files bottom-up (`utils` -> `data` -> `services` -> `store` + `store/hooks.ts` -> `hooks` -> `components` -> `layouts` -> `pages` -> root entry files).
  - Adding React-Redux v9 `.withTypes()` hooks (`useAppDispatch`, `useAppSelector`) in `src/store/hooks.ts`.
- **Migration Phase 2 (Component Props, Generic Hooks, Discriminated Unions & Strict Mode):**
  - Co-locating explicit component prop interfaces in each `.tsx` file, including generic `DropdownProps<T>`, DOM event types, and typed refs.
  - Refactoring `useFetch<T>` with TypeScript generics, overloaded `initialData` signatures, and a hybrid discriminated union (`status: 'idle' | 'loading' | 'success' | 'error'`).
  - Refactoring `ProductListingPage` and `ProductDetailPage` to replace separate `isLoading`/`error`/`data` `useState` calls with a single discriminated union state (`status: 'loading' | 'success' | 'error'`).
  - Enabling `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`, `"noFallthroughCasesInSwitch": true`, and `"allowJs": false` once all files are migrated.
- Updating `docs/adr/0006-*.md`, `docs/` inventories, `.agent/rules/`, and `AGENTS.md` to reflect the TypeScript baseline ahead of Phase 6.

### Out of Scope
- Runtime behavior or visual UI changes.
- Phase 6 Dedicated Cart Page & Checkout implementation (will be authored directly in TypeScript in its own SDD after this migration lands).
- Replacing the simulated API (`src/services/api.ts`) with an external backend.
- Introducing automated unit/integration test runners (tracked separately in `SDD-0002`).

---

## 3. Migration Strategy & Phased Execution Plan

### Phase 1: Coexistence, Domain Types/Interfaces & File-by-File Rename

#### Step 1.1 — Tooling & Compiler Bootstrap (`allowJs` Enabled)
1. Install `typescript` in `devDependencies` (`@types/react` and `@types/react-dom` are already installed in `package.json`).
2. Create `src/vite-env.d.ts` with `/// <reference types="vite/client" />` so asset imports (`.svg`, `.css`) typecheck cleanly.
3. Create `tsconfig.json` (app) configured for gradual migration:
   - `"target": "ES2022"`, `"lib": ["ES2023", "DOM", "DOM.Iterable"]`
   - `"module": "ESNext"`, `"moduleResolution": "bundler"`
   - `"jsx": "react-jsx"`
   - `"noEmit": true`, `"isolatedModules": true`, `"skipLibCheck": true`
   - `"allowJs": true`, `"checkJs": false` (allows `.js`/`.jsx` and `.ts`/`.tsx` to coexist)
   - `"strict": false` (temporarily relaxed until Phase 2 final step)
4. Create `tsconfig.node.json` covering `vite.config.ts` (`"moduleResolution": "bundler"`, `"strict": true`, `"noEmit": true`).
5. Update `package.json` scripts:
   - `"typecheck": "tsc --noEmit"`
   - `"build": "tsc --noEmit && vite build"`
6. Enable the `"typescript"` plugin in `.oxlintrc.json` and add `"typescript/no-explicit-any": "error"`.

#### Step 1.2 — Shared Domain Types & Interfaces (`src/types/`)
Centralized domain contracts live in `src/types/` (hybrid strategy: domain entities centralized in `src/types/`, component props co-located in `.tsx` files):

- **`src/types/currency.ts`**
  - `export type CurrencyCode = 'BRL' | 'USD' | 'EUR';`
  - `export interface CurrencyConfig { code: CurrencyCode; label: string; symbol: string; rate: number; locale: string; }`
- **`src/types/product.ts`**
  - `export interface RawPriceInput { regular_price?: number; special_price?: number | null | ''; }`
  - `export interface CalculatedPrice { regular_price: number; special_price: number | null; final_price: number; discount_percentage: number; has_discount: boolean; }`
  - `export interface ProductRating { rate: number; count: number; }`
  - `export interface ProductSpec { label: string; value: string; }`
  - `export interface ManufacturerInfo { brand: string; origin: string; warrantyText: string; sustainability: string; support: string; }`
  - `export interface RawProduct { id: number; name: string; price: RawPriceInput; category: string; image: string; rating: ProductRating; stock: number; description: string; }`
  - `export interface Product extends Omit<RawProduct, 'price'> { price: CalculatedPrice; images: string[]; specs: ProductSpec[]; manufacturer: ManufacturerInfo; }`
  - `export type ProductSortOption = '' | 'price-asc' | 'price-desc' | 'rating' | 'name';`
- **`src/types/cart.ts`**
  - `export interface CartItem { id: number; name: string; price: CalculatedPrice; image: string; category: string; stock: number; quantity: number; }`
  - `export type StockWarningsMap = Record<number, string>;`
  - `export type AddToCartPayload = { product: Product; quantity?: number } | Product;`
- **`src/types/api.ts`**
  - `export interface GetProductsParams { category?: string; search?: string; sortBy?: ProductSortOption; page?: number; limit?: number; signal?: AbortSignal; delayMs?: number; }`
  - `export interface PaginatedProductsResponse { products: Product[]; total: number; page?: number; totalPages?: number; }`
  - `export interface SearchProductsParams { query?: string; limit?: number; signal?: AbortSignal; delayMs?: number; }`
  - `export interface StockValidationResult { available: boolean; maxStock: number; message: string | null; }`
  - `export type AsyncRequestState<T> = { status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: string };`
- **`src/types/index.ts`** — Re-exports all domain types and interfaces.

#### Step 1.3 — Bottom-Up File-by-File Rename (`.js`/`.jsx` -> `.ts`/`.tsx`)
Migrate one layer at a time in dependency order. As each file is migrated, strip explicit `.js`/`.jsx` extensions from its imports to extensionless module specifiers (`moduleResolution: "bundler"`):

| Order | Layer | Source File (`.js` / `.jsx`) | Target File (`.ts` / `.tsx`) | Key Typing Additions |
| :---: | :--- | :--- | :--- | :--- |
| 1 | **Utils** | `src/utils/currency.js` | `src/utils/currency.ts` | Type `SUPPORTED_CURRENCIES: Record<CurrencyCode, CurrencyConfig>`, `convertCurrency`, `formatCurrencyWithCode` |
| 2 | **Utils** | `src/utils/price.js` | `src/utils/price.ts` | Type `calculatePrice(rawPrice?: RawPriceInput \| number): CalculatedPrice` |
| 3 | **Data** | `src/data/products.js` | `src/data/products.ts` | Type `RAW_PRODUCTS: RawProduct[]` and `PRODUCTS_MOCK: Product[]` |
| 4 | **Services** | `src/services/api.js` | `src/services/api.ts` | Type `delay(ms?: number, signal?: AbortSignal): Promise<void>` and all `productsApi` methods |
| 5 | **Store** | `src/store/slices/currencySlice.js` | `src/store/slices/currencySlice.ts` | `CurrencyState` interface, `PayloadAction<CurrencyCode>`, `localStorage` type guard |
| 6 | **Store** | `src/store/slices/cartSlice.js` | `src/store/slices/cartSlice.ts` | `CartState` interface, typed `PayloadAction<AddToCartPayload>`, `updateQuantity`, `setStockWarning`, `removeFromCart` |
| 7 | **Store** | `src/store/index.js` | `src/store/index.ts` | Export `RootState = ReturnType<typeof store.getState>` and `AppDispatch = typeof store.dispatch` |
| 8 | **Store Hooks** | *(new)* | `src/store/hooks.ts` | Export `useAppDispatch = useDispatch.withTypes<AppDispatch>()` and `useAppSelector = useSelector.withTypes<RootState>()` |
| 9 | **Hooks** | `src/hooks/useCurrency.js` | `src/hooks/useCurrency.ts` | Consume `useAppDispatch`/`useAppSelector`; typed `UseCurrencyReturn` |
| 10 | **Hooks** | `src/hooks/useCart.js` | `src/hooks/useCart.ts` | Consume `useAppDispatch`/`useAppSelector`; typed `UseCartReturn` |
| 11 | **Hooks** | `src/hooks/useFetch.js` | `src/hooks/useFetch.ts` | Initial TS rename (enhanced with generics, overloads & discriminated union in Phase 2) |
| 12 | **Components** | `src/components/PriceBox/PriceBox.jsx` | `src/components/PriceBox/PriceBox.tsx` | Component rename + `PriceBoxProps` |
| 13 | **Components** | `src/components/Dropdown/Dropdown.jsx` | `src/components/Dropdown/Dropdown.tsx` | Component rename + generic `DropdownProps<T>` |
| 14 | **Components** | `src/components/ProductCard/ProductCard.jsx` | `src/components/ProductCard/ProductCard.tsx` | Component rename + `ProductCardProps` |
| 15 | **Components** | `src/components/SearchBar/SearchBar.jsx` | `src/components/SearchBar/SearchBar.tsx` | Component rename + `SearchBarProps`, keyboard/mouse event types |
| 16 | **Components** | `src/components/Navbar/Navbar.jsx` | `src/components/Navbar/Navbar.tsx` | Component rename |
| 17 | **Components** | `src/components/MiniCart/MiniCart.jsx` | `src/components/MiniCart/MiniCart.tsx` | Component rename + `CartItemProps` subcomponent interface |
| 18 | **Layouts** | `src/layouts/RootLayout/RootLayout.jsx` | `src/layouts/RootLayout/RootLayout.tsx` | Layout rename |
| 19 | **Pages** | `src/pages/ProductListingPage/ProductListingPage.jsx` | `src/pages/ProductListingPage/ProductListingPage.tsx` | Page rename + filter/sort types |
| 20 | **Pages** | `src/pages/ProductDetailPage/ProductDetailPage.jsx` | `src/pages/ProductDetailPage/ProductDetailPage.tsx` | Page rename + `useParams<{ id: string }>()` and tab union |
| 21 | **Root** | `src/App.jsx`, `src/main.jsx`, `vite.config.js` | `src/App.tsx`, `src/main.tsx`, `vite.config.ts` | Update `index.html` `<script src="/src/main.tsx">` and `#root` null guard |

---

### Phase 2: Component Props, Generic `useFetch<T>`, Discriminated Unions & Strict Mode

#### Step 2.1 — Co-Located Component Prop Interfaces & DOM Event Types
Define exported prop interfaces inside each `.tsx` component module:
- **`DropdownProps<T extends string | number = string>`** (`src/components/Dropdown/Dropdown.tsx`):
  ```ts
  export interface DropdownOption<T extends string | number = string> {
    value: T;
    label: string;
  }
  export interface DropdownProps<T extends string | number = string> {
    options?: DropdownOption<T>[];
    value: T;
    onChange?: (value: T) => void;
    placeholder?: string;
    size?: 'sm' | 'md' | 'lg';
    align?: 'left' | 'right';
    className?: string;
    ariaLabel?: string;
  }
  ```
  - Event/ref types: `useRef<HTMLDivElement | null>(null)`, `PointerEvent` (`Node` check via `event.target instanceof Node`), `React.KeyboardEvent<HTMLDivElement>`.
- **`PriceBoxProps`** (`src/components/PriceBox/PriceBox.tsx`):
  ```ts
  export interface PriceBoxProps {
    price: CalculatedPrice | RawPriceInput | number;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    currency?: CurrencyCode;
  }
  ```
- **`ProductCardProps`** (`src/components/ProductCard/ProductCard.tsx`):
  ```ts
  export interface ProductCardProps {
    product: Product | null | undefined;
    onAddToCart?: (product: Product) => void;
  }
  ```
- **`SearchBarProps` & `HighlightMatchProps`** (`src/components/SearchBar/SearchBar.tsx`):
  ```ts
  export interface SearchBarProps {
    placeholder?: string;
  }
  interface HighlightMatchProps {
    text: string;
    query: string;
  }
  ```
  - Event/ref types: `useRef<HTMLDivElement | null>(null)`, `useRef<HTMLInputElement | null>(null)`, `MouseEvent` (`e.target instanceof Node`), `React.KeyboardEvent<HTMLInputElement>`.
- **`CartItemProps`** (`src/components/MiniCart/MiniCart.tsx`):
  ```ts
  interface CartItemProps {
    item: CartItem;
    onUpdateQuantity: (id: number, quantity: number) => void;
    onRemove: (id: number) => void;
    warning?: string;
  }
  ```
  - Timer/abort ref types: `useRef<ReturnType<typeof setTimeout> | null>(null)`, `useRef<AbortController | null>(null)`, `React.ChangeEvent<HTMLInputElement>`, `KeyboardEvent` listener.

#### Step 2.2 — Generic `useFetch<T>` with Overloads & Hybrid Discriminated Union
Refactor `src/hooks/useFetch.ts` to be generic over `T` with overloaded `initialData` options and a hybrid discriminated union (`status: 'idle' | 'loading' | 'success' | 'error'`) so both `switch (state.status)` narrowing and `{ data, isLoading, error }` destructuring work seamlessly:

```ts
export interface UseFetchFetcherOptions {
  signal: AbortSignal;
}

export type UseFetchFetcher<T> = (
  query: string,
  options: UseFetchFetcherOptions,
) => Promise<T>;

export interface UseFetchOptionsWithInitial<T> {
  debounceMs?: number;
  minQueryLength?: number;
  initialData: T;
}

export interface UseFetchOptionsOptional<T> {
  debounceMs?: number;
  minQueryLength?: number;
  initialData?: T;
}

export type AsyncFetchState<T> =
  | { status: 'idle'; data: T; error: null; isLoading: false }
  | { status: 'loading'; data: T; error: null; isLoading: true }
  | { status: 'success'; data: T; error: null; isLoading: false }
  | { status: 'error'; data: T; error: Error; isLoading: false };

export function useFetch<T>(
  fetcher: UseFetchFetcher<T>,
  query: string,
  options: UseFetchOptionsWithInitial<T>,
): AsyncFetchState<T>;

export function useFetch<T>(
  fetcher: UseFetchFetcher<T>,
  query: string,
  options?: UseFetchOptionsOptional<T>,
): AsyncFetchState<T | undefined>;
```

- **Narrowing guarantee:** Checking `state.status === 'error'` narrows `state.error` to `Error`; `state.status === 'loading'` narrows `state.isLoading` to `true`; `SearchBar.tsx` continues destructuring `{ data: results, isLoading }`.
- **Error narrowing in `catch (err: unknown)`:** Ignore `AbortError` (`err instanceof DOMException && err.name === 'AbortError'`); normalize non-Error throws via `err instanceof Error ? err : new Error(String(err))`.

#### Step 2.3 — Discriminated Unions for Page-Level Async States
Replace separate `isLoading`, `error`, and `data` `useState` hooks in both pages with a single discriminated union state using `AsyncRequestState<T>`:

- **`ProductListingPage.tsx`**:
  - `const [fetchState, setFetchState] = useState<AsyncRequestState<Product[]>>({ status: 'loading' });`
  - Category filter and sort dropdown state typed as `string` and `ProductSortOption`.
  - Clean up legacy native-select `newValue?.target?.value` fallback in `handleSortChange` since `Dropdown<ProductSortOption>` emits `ProductSortOption` directly.
- **`ProductDetailPage.tsx`**:
  - `const [productState, setProductState] = useState<AsyncRequestState<Product>>({ status: 'loading' });`
  - `relatedProducts: Product[]` and `activeTab: DetailTab` (`'description' | 'manufacturer' | 'specs'`).
  - Guard `if (!id)` from `useParams<{ id: string }>()` before calling `productsApi.getProductById(id, 200)`.

#### Step 2.4 — Final Strict Mode Lock-In
Once all `.js` and `.jsx` files are migrated and typed:
1. Update `tsconfig.json`:
   - Set `"allowJs": false`
   - Set `"strict": true`
   - Set `"noUnusedLocals": true`
   - Set `"noUnusedParameters": true`
   - Set `"noFallthroughCasesInSwitch": true`
2. Verify `npm run typecheck`, `npm run lint`, and `npm run build` all pass with 0 errors and 0 warnings.

---

## 4. UI, Accessibility & Dark Mode Requirements
- Strictly a static type-system migration; **zero visual, layout, theme, or accessibility regressions** are permitted.
- All ARIA attributes (`aria-expanded`, `aria-haspopup`, `aria-controls`, `role="option"`, `role="tab"`) must conform to React 19 TypeScript definitions.

---

## 5. Architecture & Contracts

### Affected Files / Modules
- **New Configuration & Ambient Files:**
  - `tsconfig.json`, `tsconfig.node.json`, `src/vite-env.d.ts`
- **New Shared Type Modules (`src/types/`):**
  - `src/types/currency.ts`, `src/types/product.ts`, `src/types/cart.ts`, `src/types/api.ts`, `src/types/index.ts`
- **New Store Typed Hooks:**
  - `src/store/hooks.ts`
- **Migrated Source Modules (`src/`):**
  - `src/utils/currency.ts`, `src/utils/price.ts`
  - `src/data/products.ts`
  - `src/services/api.ts`
  - `src/store/index.ts`, `src/store/slices/currencySlice.ts`, `src/store/slices/cartSlice.ts`
  - `src/hooks/useCurrency.ts`, `src/hooks/useCart.ts`, `src/hooks/useFetch.ts`
  - `src/components/Dropdown/Dropdown.tsx`, `src/components/MiniCart/MiniCart.tsx`, `src/components/Navbar/Navbar.tsx`, `src/components/PriceBox/PriceBox.tsx`, `src/components/ProductCard/ProductCard.tsx`, `src/components/SearchBar/SearchBar.tsx`
  - `src/layouts/RootLayout/RootLayout.tsx`
  - `src/pages/ProductListingPage/ProductListingPage.tsx`, `src/pages/ProductDetailPage/ProductDetailPage.tsx`
  - `src/App.tsx`, `src/main.tsx`
- **Modified Root & Config Files:**
  - `index.html` (`/src/main.jsx` -> `/src/main.tsx`)
  - `vite.config.ts` (renamed from `vite.config.js`)
  - `package.json` (`typescript` devDependency, `typecheck` script, `build` script)
  - `.oxlintrc.json` (`typescript` plugin + `typescript/no-explicit-any: "error"`)

---

## 6. Edge Cases & Guardrails
- **Zero `any` Policy:** Neither explicit `any` nor implicit `any` is allowed. External/untrusted inputs (`JSON.parse` from `localStorage`, `catch (err: unknown)` blocks) must be typed as `unknown` and narrowed with type guards.
- **`useUnknownInCatchVariables`:** All `try / catch (err)` blocks in `useFetch.ts`, `MiniCart.tsx`, `ProductListingPage.tsx`, and `ProductDetailPage.tsx` must narrow `err` via `err instanceof Error` or `err instanceof DOMException` before accessing `.name` or `.message`.
- **`localStorage` Hydration Type Guards:** `getInitialCart()` in `cartSlice.ts` and `getInitialCurrency()` in `currencySlice.ts` must validate parsed `unknown` data before returning typed state.
- **Root DOM Mounting (`main.tsx`):** Guard `const rootElement = document.getElementById('root'); if (!rootElement) throw new Error('Root element #root not found');` so `strictNullChecks` passes without unsafe assertions.
- **React Router Params (`ProductDetailPage.tsx`):** `useParams<{ id: string }>()` returns `id: string | undefined`; guard `if (!id)` before fetching product details.

---

## 7. Acceptance Criteria
- [x] Phase 1 completed: `tsconfig.json` initialized with `allowJs: true`, shared domain `type`s and `interface`s created under `src/types/`, and all `.js`/`.jsx` files migrated file-by-file to `.ts`/`.tsx` with extensionless imports.
- [x] Phase 2 completed: Co-located component prop interfaces added, `useFetch<T>` refactored with generics, overloads, and hybrid discriminated union (`idle | loading | success | error`), page async states refactored to discriminated unions, and `"strict": true` / `"allowJs": false` enabled at the end.
- [x] No explicit `any` (`typescript/no-explicit-any: "error"` in Oxlint) and no implicit `any` (`noImplicitAny: true` in `tsconfig.json`).
- [x] Zero remaining `.js` or `.jsx` files under `src/`.
- [x] `npm run typecheck` (`tsc --noEmit`) runs with 0 errors.
- [x] `npm run lint` passes with 0 errors and 0 warnings.
- [x] `npm run build` (`tsc --noEmit && vite build`) succeeds.
- [ ] All modules and user flows (PLP filtering/sorting, live search, currency switching, PDP tabs/gallery, MiniCart stock validation and `localStorage` persistence) work identically in the browser. *(Pending manual browser verification: Chrome DevTools remote debugging `DevToolsActivePort` unavailable in environment.)*
- [x] `docs/` inventories, `docs/adr/0006-incremental-typescript-migration.md`, `.agent/rules/`, and `AGENTS.md` updated upon implementation.

---

## 8. Verification Plan
1. **Compiler Check:** Run `npm run typecheck` (`tsc --noEmit`) and verify zero diagnostics.
2. **Linter Check:** Run `npm run lint` (`oxlint`) to verify zero `typescript/no-explicit-any` or React hook rule violations.
3. **Production Bundle Check:** Run `npm run build` to verify TypeScript check + Vite production bundle succeeds.
4. **File Inventory Check:** Confirm `find src -name "*.js" -o -name "*.jsx"` returns empty output.
5. **End-to-End Browser Smoke Test:** Start `npm run dev` (`http://localhost:5199`) and validate catalog browsing, category/sort dropdowns, debounced `SearchBar`, `BRL`/`USD`/`EUR` conversion, `ProductDetailPage` navigation, and `MiniCart` quantity validation in Light and Dark modes.
