# SDD-0001: Dedicated Cart Page & Checkout Flow

- **Status:** In Progress (Increment 1: Dedicated Cart Page with Context + `useReducer`)
- **Phase:** Phase 6
- **Author:** Antigravity
- **Date:** 2026-11-20
- **Related ADRs:** [`docs/adr/0008-cart-page-context-reducer-baseline.md`](../adr/0008-cart-page-context-reducer-baseline.md), [`docs/adr/0003-redux-toolkit-with-localstorage-persistence.md`](../adr/0003-redux-toolkit-with-localstorage-persistence.md)

---

## 1. Problem Statement & Goal
Currently, clicking **View Full Cart** in `MiniCart` displays a placeholder notice (`"Dedicated cart page is under development."`). Users need a full-page `/cart` workspace to review items, adjust quantities with stock validation, apply promo coupons, choose shipping options, add delivery/gift notes, and view a complete cost breakdown.

For **Increment 1**, the Cart Page is intentionally built with a **single monolithic React Context + `useReducer`** (`CartPageContext`) without splitting contexts or applying `React.memo`, so developers can directly observe and inspect Context re-render propagation with React DevTools before optimizing in subsequent increments.

## 2. Scope
### In Scope (Increment 1)
- Add `/cart` route (`CartPage`) inside `RootLayout` (`src/App.tsx`).
- Wire `MiniCart` **"View Full Cart"** button to close the drawer and navigate to `/cart`.
- Implement `CartPageContext` + `cartPageReducer` (`src/context/cartPageState.ts`, `src/context/CartPageProvider.tsx`) managing:
  - Cart `items` (bi-directionally synced with Redux `cartSlice` via `replaceCartItems` and `localStorage` `minieshop_cart`)
  - Promo coupon input, validation (`MINIE10`, `MINIE20`, `FREESHIP`), and discount calculation
  - Shipping method selection (`standard`, `express`, `pickup`) with free-shipping threshold (`>= 500 BRL` or `FREESHIP`)
  - Order/delivery note (`maxLength = 200`)
  - Per-item stock warnings
- Reuse `useDebounce` + `useStockValidationQuery` in `CartItemRow` and `useCurrency` for multi-currency conversion (`BRL`, `USD`, `EUR`).

### Out of Scope (Future Phase 6 Increments)
- Context splitting / `React.memo` optimization or migrating promo/shipping state into Redux Toolkit (Increment 2).
- Dedicated Checkout form and Order Confirmation page (Increment 3).

## 3. Functional Requirements
1. **FR-1 — Navigation & SEO:** Navigating to `/cart` (directly or via `MiniCart`'s **View Full Cart** button) renders `CartPage` with dynamic `<Helmet>` `<title>` (`Shopping Cart (N) | Minie Shop` or `Shopping Cart | Minie Shop`).
2. **FR-2 — Monolithic Context + `useReducer` State:** All Cart Page subcomponents consume a single `CartPageContext` powered by `useReducer`, causing any dispatched action (`UPDATE_QUANTITY`, `SET_COUPON_INPUT`, `APPLY_COUPON`, `SET_SHIPPING_METHOD`, `SET_ORDER_NOTE`, etc.) to re-render all subscribed components (observable via React DevTools Profiler / Highlight Updates).
3. **FR-3 — Cart Item Editing & Stock Validation:** Users can increment, decrement, type quantities (`1..maxStock`), remove individual items, or clear the cart. Quantity edits trigger `300ms` debounced `useStockValidationQuery` checks and update `Navbar`'s badge + `localStorage` (`minieshop_cart`).
4. **FR-4 — Promo Coupons & Shipping Calculation:**
   - `MINIE10`: 10% discount on items subtotal.
   - `MINIE20`: 20% discount on items subtotal.
   - `FREESHIP`: waives Standard/Express shipping fee.
   - Invalid/empty codes display an accessible `role="alert"` error.
   - `standard` shipping (`19.90 BRL`) becomes free when subtotal `>= 500 BRL` or `FREESHIP` is applied; `express` is `49.90 BRL` (free with `FREESHIP`); `pickup` is always free (`0`).
5. **FR-5 — Multi-Currency Consistency:** All unit prices, line totals, discounts, shipping rates, free-shipping progress, and order totals convert and format dynamically via `useCurrency()`.
6. **FR-6 — Empty Cart State:** When `items.length === 0`, `CartPage` displays a clean empty state with an inline SVG icon and **Explore Catalog** link (`/`).

## 4. UI, Accessibility & Dark Mode Requirements
- Consume design tokens in `src/index.css` for full Light and Dark mode support (`@media (prefers-color-scheme: dark)` and `[data-theme="dark"]` / `html.dark`).
- Zero emojis in UI; use inline vector `<svg>` icons (`aria-hidden="true"` when decorative).
- Responsive 2-column desktop layout (`>= 1024px`: item list + configuration panels on the left, sticky summary sidebar on the right) stacking cleanly on tablet and mobile viewports (`<= 1023px`, `<= 640px`).
- Accessible landmarks, breadcrumb `<nav aria-label="Breadcrumb">`, `role="alert"` for coupon/stock errors, `role="status"` for checkout increment notice, radio group semantics for shipping options, and descriptive `aria-label` attributes on quantity/remove controls.

## 5. Architecture & Contracts
### Affected Files / Modules
- `src/store/slices/cartSlice.ts` (`replaceCartItems` action)
- `src/hooks/useCart.ts` (expose `replaceCartItems`)
- `src/context/cartPageState.ts`
- `src/context/CartPageProvider.tsx`
- `src/components/MiniCart/MiniCart.tsx` (navigate to `/cart` on **View Full Cart**)
- `src/App.tsx` (add `<Route path="cart" element={<CartPage />} />`)
- `src/pages/CartPage/CartPage.tsx`, `CartPage.css`
- `src/pages/CartPage/components/CartHeader.tsx`
- `src/pages/CartPage/components/CartItemRow.tsx`
- `src/pages/CartPage/components/CartPromoBox.tsx`
- `src/pages/CartPage/components/CartShippingSelector.tsx`
- `src/pages/CartPage/components/CartOrderNote.tsx`
- `src/pages/CartPage/components/CartOrderSummary.tsx`

## 6. Edge Cases & Guardrails
- **Bi-directional sync without infinite loops:** Value-based equality (`areCartItemsEqual`) + refs guard syncing between `CartPageProvider` and Redux `cartSlice`.
- **Quantity bounds:** Clamp numeric inputs to `1..maxStock` (fallback `99`).
- **Coupon edge cases:** Case-insensitive trimming on coupon submit; removing all items resets or preserves gracefully without negative totals (`Math.max(0, subtotal - discountAmount)`).
- **Strict TypeScript & Oxlint:** Zero `any`, zero unused locals/params, extensionless `.ts`/`.tsx` imports, 0 lint warnings/errors.

## 7. Acceptance Criteria
- [ ] Navigating to `/cart` directly or via `MiniCart` **View Full Cart** renders `CartPage`.
- [ ] Typing in `CartOrderNote` / `CartPromoBox`, changing `CartShippingSelector`, or editing an item quantity triggers observable re-renders across all Cart Page components via `CartPageContext` + `useReducer`.
- [ ] Quantity updates, removals, and clear cart sync with `Navbar` count badge, `MiniCart`, and `localStorage` (`minieshop_cart`).
- [ ] Promo coupons (`MINIE10`, `MINIE20`, `FREESHIP`, invalid code), shipping methods, and currency switches (`BRL`, `USD`, `EUR`) calculate totals accurately.
- [ ] `npm run typecheck`, `npm run lint`, and `npm run build` pass with 0 errors and 0 warnings.
- [ ] Browser flow evidenced across Desktop & Mobile, Light & Dark modes.
- [ ] `docs/` inventories and `AGENTS.md` updated.

## 8. Verification Plan
1. Run `npm run typecheck && npm run lint && npm run build`.
2. Start dev server (`npm run dev` on port `5199`) and run browser verification:
   - Add 2+ products on `/`, open `MiniCart`, click **View Full Cart** -> verify navigation to `/cart`.
   - Record initial render counts; type in Order Note -> verify all component render counters increment together.
   - Apply `MINIE10`, test invalid code, switch to `FREESHIP` and `express` shipping -> verify summary math & render increments.
   - Edit item quantities (triggering stock validation & max-stock warning), switch currency (`USD`), reload page -> verify persistence.
   - Remove an item, clear cart -> verify empty state and `Navbar` count `0`.
   - Verify Light Mode, Dark Mode, and Mobile (`390x844`) responsive layout.
