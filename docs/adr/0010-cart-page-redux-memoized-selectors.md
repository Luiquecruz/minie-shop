# ADR-0010: Migrate CartPage to Pure Functional Redux Toolkit Slice & Memoized `createSelector`

- **Status:** Accepted
- **Date:** 2026-11-21
- **Phase:** Phase 6 — Increment 2
- **Related SDD:** [`docs/sdd/0001-dedicated-cart-and-checkout.md`](../sdd/0001-dedicated-cart-and-checkout.md)
- **Supersedes:** [`ADR-0008`](./0008-cart-page-context-reducer-baseline.md)
- **Extends:** [`ADR-0003`](./0003-redux-toolkit-with-localstorage-persistence.md)

## Context
Under [`ADR-0008`](./0008-cart-page-context-reducer-baseline.md), `CartPage` (`/cart`) was initially implemented using a single monolithic `CartPageContext` + `useReducer`. React `<Profiler>` measurements across 4 isolated interactions (2 items in cart) confirmed severe re-render fan-out:
- Typing 4 chars (`"Gift"`) in `CartOrderNote`: **28 component updates** (all 7 CartPage components re-rendered 4 times each).
- Typing 3 chars (`"MIN"`) in `CartPromoBox`: **21 component updates**.
- Switching shipping method (`standard` -> `express`): **7 component updates**.
- Incrementing Item #1 quantity: **14 component updates** (including unrelated Item #2, `CartPromoBox`, `CartShippingSelector`, `CartOrderNote`).
- **Total measured updates across the 4 actions:** **70**.

## Decision
- Remove `CartPageProvider` (`src/context/`) and consolidate all CartPage state (`couponInput`, `appliedCoupon`, `couponError`, `shippingMethod`, `orderNote`, alongside `items`, `isOpen`, `stockWarnings`) into `cartSlice` (`src/store/slices/cartSlice.ts`).
- Author all `cartSlice` reducers as **pure immutable functions** (no `push`, `delete`, or in-place mutation; preserve structural sharing for untouched `CartItem` references; return existing state reference on no-op actions).
- Decouple `localStorage` side effects from reducers into `src/store/persistence/cartStorage.ts` (`minieshop_cart` and `minieshop_cart_prefs`), hydrated via `hydrateCartState()` and persisted via RTK `createListenerMiddleware` in `src/store/index.ts`.
- Move and expand derived selectors into `src/store/selectors/cartSelectors.ts` using `createSelector` (`selectCartItemIds`, `selectCartItemsByIdMap`, `selectCartCount`, `selectCartSubtotal`, `selectCartDiscountAmount`, `selectCartShippingCost`, `selectCartFreeShippingRemaining`, `selectCartTotal`).
- Expose granular memoized hooks in `src/hooks/useCart.ts` (`useCartActions`, `useCartPageMeta`, `useCartItemIds` with `shallowEqual`, `useCartItemState`, `useCartPromoState`, `useCartShippingState`, `useCartOrderNoteState`, `useCartSummaryState`) and wrap all `CartPage` subcomponents in `React.memo`.

## Measured React `<Profiler>` Comparison (Before vs. After)

| Interaction | Before (`Context + useReducer`) | After (`Redux + createSelector + memo`) | Reduction |
| :--- | :---: | :---: | :---: |
| Type `"Gift"` (4 chars) in `CartOrderNote` | 28 updates | 8 updates (`OrderNote`: 4, `Summary`: 4; 5 siblings: `0`) | -71.4% |
| Type `"MIN"` (3 chars) in `CartPromoBox` | 21 updates | 3 updates (`PromoBox`: 3; 6 siblings: `0`) | -85.7% |
| Switch shipping (`standard` -> `express`) | 7 updates | 2 updates (`Shipping`: 1, `Summary`: 1; 5 siblings: `0`) | -71.4% |
| Increment Item #1 quantity (`+`) | 14 updates | 3 updates (`Header`: 1, `Item1`: 1, `Summary`: 1; `Item2` & 3 others: `0`) | -78.6% |
| **Total across all 4 interactions** | **70 updates** | **16 updates** | **-77.1%** |

## Consequences
### Positive
- Eliminates all cross-panel and sibling-row re-renders while preserving 100% identical UX and behavior.
- Reducers have zero side effects and are trivially unit-testable with `deepFreeze`.
- Persists cart line items (`minieshop_cart`) and checkout preferences (`minieshop_cart_prefs`) across page reloads.

### Negative / Trade-offs
- Requires maintaining pure structural-sharing discipline and granular hooks in `src/hooks/useCart.ts` when adding Phase 6 Checkout fields.
