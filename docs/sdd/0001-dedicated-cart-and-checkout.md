# SDD-0001: Dedicated Cart Page & Checkout Flow

- **Status:** In Progress (Increments 1 & 2 Implemented; Increment 3 Checkout Pending)
- **Phase:** Phase 6
- **Author:** Antigravity
- **Date:** 2026-11-20 (Updated 2026-11-21 for Increment 2)
- **Related ADRs:** [`ADR-0001`](../adr/0001-frontend-architecture-baseline.md) *(consolidates former ADRs `0003`, `0008`, `0009`, `0010`)*

---

## 1. Problem Statement & Goal
Users need a dedicated `/cart` workspace to review items, adjust quantities with stock validation, apply promo coupons, choose shipping options, add delivery/gift notes, and inspect a cost breakdown.

- **Increment 1 (Baseline):** Built `/cart` first with a single monolithic `CartPageContext` + `useReducer` (`ADR-0008`) to observe Context re-render fan-out and measure baseline update counts via React `<Profiler>`.
- **Increment 2 (Optimization & Migration):** Migrated `/cart` to a pure functional Redux Toolkit `cartSlice` (`ADR-0010`) with structural sharing, listener-based `localStorage` persistence (`minieshop_cart` & `minieshop_cart_prefs`), memoized `createSelector` selectors, granular hooks, `React.memo` components, and automated Vitest unit + React `<Profiler>` tests (`ADR-0009`).

## 2. Scope
### In Scope (Increments 1 & 2)
- `/cart` route (`CartPage`) inside `RootLayout` (`src/App.tsx`) and `MiniCart` **View Full Cart** navigation.
- Pure immutable `cartSlice` (`src/store/slices/cartSlice.ts`) with zero side effects inside reducers.
- Listener-based `localStorage` persistence (`src/store/persistence/cartStorage.ts`, wired via `createListenerMiddleware` in `src/store/index.ts`).
- Memoized `createSelector` suite (`src/store/selectors/cartSelectors.ts`) and granular hooks (`src/hooks/useCart.ts`).
- `React.memo`-wrapped `CartPage` subcomponents (`CartHeader`, `CartItemRow`, `CartPromoBox`, `CartShippingSelector`, `CartOrderNote`, `CartOrderSummary`).
- Automated unit & `<Profiler>` test suite (`cartSlice.test.ts`, `cartSelectors.test.ts`, `CartPage.profiler.test.tsx`).

### Out of Scope (Increment 3)
- Dedicated Checkout form and Order Confirmation flow.

## 3. Functional Requirements
1. **FR-1 — Navigation & SEO:** Navigating to `/cart` renders `CartPage` with dynamic `<Helmet>` `<title>` (`Shopping Cart (N) | Minie Shop` or `Shopping Cart | Minie Shop`).
2. **FR-2 — Pure Reducers & Persistence:** All cart actions (`addToCart`, `updateQuantity`, `removeFromCart`, `clearCart`, `setCouponInput`, `applyCoupon`, `removeCoupon`, `setShippingMethod`, `setOrderNote`) execute purely and immutably, while `createListenerMiddleware` persists `items` (`minieshop_cart`) and checkout preferences (`minieshop_cart_prefs`).
3. **FR-3 — Memoized Selectors & Re-render Isolation:** Editing one line item, typing promo input, typing order notes, or switching shipping only re-renders directly subscribed components.
4. **FR-4 — Promo Coupons & Shipping Calculation:**
   - `MINIE10` (10% off), `MINIE20` (20% off), `FREESHIP` (free Standard/Express shipping), and accessible error alerts for invalid/empty codes.
   - `standard` (`19.90 BRL`, free when subtotal `>= 500 BRL` or `FREESHIP`), `express` (`49.90 BRL`, free with `FREESHIP`), `pickup` (`0 BRL`).
5. **FR-5 — Multi-Currency & Empty State:** All prices convert via `useCurrency()`; empty cart renders SVG empty state with **Explore Catalog** link.

## 4. Acceptance Criteria
- [x] `CartPage` built first with monolithic Context + `useReducer` and baseline `<Profiler>` counts captured (70 updates across 4 actions).
- [x] Migrated to pure functional Redux Toolkit `cartSlice` + `localStorage` listener persistence + memoized `createSelector` + `React.memo`.
- [x] `<Profiler>` re-renders reduced from **70** to **16** (-77.1%) with **0** wasted sibling updates.
- [x] Automated tests for reducers, selectors, and `<Profiler>` pass via `npm test`.
- [x] `npm run typecheck`, `npm run lint`, and `npm run build` pass with 0 errors and 0 warnings.
- [x] `docs/` inventories, ADRs, and `AGENTS.md` updated.
