# ADR-0008: Dedicated Cart Page Baseline with Monolithic React Context and `useReducer`

- **Status:** Superseded by [`ADR-0010`](./0010-cart-page-redux-memoized-selectors.md)
- **Date:** 2026-11-20
- **Phase:** Phase 6 — Increment 1
- **Related SDD:** [`docs/sdd/0001-dedicated-cart-and-checkout.md`](../sdd/0001-dedicated-cart-and-checkout.md)
- **Related ADRs:** [`ADR-0003`](./0003-redux-toolkit-with-localstorage-persistence.md)

## Context
Phase 6 introduces a dedicated shopping cart route (`/cart`) with richer interactions than `MiniCart`: multi-item editing, promo coupon application (`MINIE10`, `MINIE20`, `FREESHIP`), shipping method selection (`standard`, `express`, `pickup`), order/gift notes, and a sticky order summary.

Because **Progressive Minie Shop** is built incrementally to explore and contrast React state management patterns in practice, we want the first increment of `/cart` to use a **single monolithic React Context + `useReducer`** before introducing render optimizations or moving extended checkout state to Redux Toolkit.

## Decision
- Add the `/cart` route (`CartPage`) inside `RootLayout` (`src/App.tsx`) and wire `MiniCart`'s **"View Full Cart"** action to navigate directly to `/cart`.
- Implement `CartPage` state management via a single `CartPageContext` backed by `useReducer` (`src/context/cartPageState.ts` and `src/context/CartPageProvider.tsx`), intentionally keeping all state slices (`items`, `couponInput`, `appliedCoupon`, `shippingMethod`, `orderNote`, `stockWarnings`) and action dispatchers in one un-split, un-memoized Context value so Context re-render propagation across `CartHeader`, `CartItemRow`, `CartPromoBox`, `CartShippingSelector`, `CartOrderNote`, and `CartOrderSummary` can be observed directly in React DevTools.
- Preserve [ADR-0003](./0003-redux-toolkit-with-localstorage-persistence.md) for global shell state (`Navbar`, `MiniCart`, `PLP`, `PDP`) by adding a `replaceCartItems` synchronization action to `cartSlice` (`src/store/slices/cartSlice.ts`). `CartPageProvider` synchronizes item mutations bi-directionally with `cartSlice` (and `localStorage` key `minieshop_cart`) using value-equality guards so `Navbar` badges and `MiniCart` never drift out of sync.

## Alternatives Considered
- **Extending `cartSlice` (Redux Toolkit) immediately:** Rejected for Increment 1 because doing so skips hands-on observation of monolithic Context + `useReducer` re-render propagation across sibling UI panels.
- **Splitting State/Dispatch Contexts and applying `React.memo` upfront:** Deferred to Increment 2 so the baseline re-render behavior can be measured and contrasted before optimizing.

## Consequences
### Positive
- Makes Context re-render fan-out tangible in the browser (e.g., typing in `CartOrderNote` or toggling shipping re-renders every `CartItemRow` and summary panel).
- Zero regression to `Navbar`, `MiniCart`, `PLP`, and `PDP`, which continue consuming `useCart()` / `cartSlice` seamlessly.
- Establishes a clear baseline to benchmark future Context-splitting or Redux migration increments.

### Negative / Trade-offs
- Unnecessary re-renders occur on `/cart` subcomponents on any state update (intentional for this increment).
- Requires careful bi-directional sync between `CartPageProvider` and `cartSlice` for `items` while `CartPageContext` owns `/cart`-local state.

## Incremental Evolution Notes
Future Phase 6 increments will:
1. Split/memoize Context (or migrate promo/shipping/checkout state into Redux Toolkit) and compare render counts against this baseline.
2. Implement the Checkout flow and order confirmation route.
