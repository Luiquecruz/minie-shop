# ADR-0003: Redux Toolkit Store (`currency`, `cart`) with `localStorage` Persistence

- **Status:** Accepted
- **Date:** 2026-10-27
- **Phase:** Phase 3–5

## Context
Both multi-currency selection (`BRL`, `USD`, `EUR`) and shopping cart state (`items`, `isOpen`, `stockWarnings`) are needed simultaneously across `Navbar`, `ProductListingPage`, `ProductDetailPage`, `ProductCard`, `PriceBox`, and `MiniCart`, and must survive browser reloads.

## Decision
- Adopt **`@reduxjs/toolkit` `^2.13.0`** and **`react-redux` `^9.3.0`** configured in `src/store/index.js`.
- Maintain two domain slices:
  - `currencySlice` (`src/store/slices/currencySlice.js`): stores `currentCurrency`, validates against `SUPPORTED_CURRENCIES`, persists to `localStorage` (`minieshop_currency`).
  - `cartSlice` (`src/store/slices/cartSlice.js`): stores `items`, `isOpen`, and `stockWarnings`; clamps quantities against `1..product.stock` (fallback `99`); auto-opens `MiniCart` on `addToCart`; persists `items` to `localStorage` (`minieshop_cart`).

## Alternatives Considered
- **React Context + `useReducer`:** Rejected to avoid provider nesting and unnecessary re-renders across unrelated price/cart subscribers, and to practice Redux Toolkit slice/selector patterns.

## Consequences
### Positive
- Single predictable store with pure reducers, memoizable selectors, and defensive `localStorage` read/write `try/catch` guards.
- Stock guardrails enforced centrally in reducers regardless of which component triggers `addToCart` or `updateQuantity`.

### Negative / Trade-offs
- Base prices stored inside cart items remain denominated in `BRL` and are converted on render via `useCurrency()`.

## Incremental Evolution Notes
Phase 6 Checkout may introduce an `orders` or `checkout` slice or extend `cartSlice` with shipping/coupon totals.
