# ADR-0002: Declarative Routing with Canonical `RootLayout` and `react-helmet-async`

- **Status:** Accepted
- **Date:** 2026-10-24
- **Phase:** Phase 2–4

## Context
The storefront requires multiple routes (Product Listing Page at `/`, Product Detail Page at `/product/:id`, and future Cart/Checkout routes) sharing persistent navigation, footer, and slide-over cart chrome, alongside dynamic per-route SEO metadata.

## Decision
- Adopt **`react-router-dom` `^7.18.4`** using declarative `<BrowserRouter>`, `<Routes>`, and `<Route>` in `src/App.jsx`.
- Implement React Router's canonical **Layout Route** pattern via `src/layouts/RootLayout/RootLayout.jsx` rendering `<Navbar />`, `<main><Outlet /></main>`, `<footer>`, and `<MiniCart />`.
- Adopt **`react-helmet-async` `^3.0.0`** (`<HelmetProvider>` in `src/App.jsx` and `<Helmet>` per page) for dynamic document `<title>` and `<meta name="description">`.

## Alternatives Considered
- **Data Router (`createBrowserRouter`):** Deferred in favor of simpler declarative `<BrowserRouter>` routing while data fetching stays inside component hooks and `productsApi`.
- **Manual `document.title` mutations:** Rejected in favor of `<Helmet>` for declarative head management per route (including PDP 404/not-found states).

## Consequences
### Positive
- Shared `Navbar` and `MiniCart` never unmount across route transitions.
- Adding Phase 6 routes (`/cart`, `/checkout`) requires only adding nested `<Route>` entries under `<RootLayout />`.

### Negative / Trade-offs
- Route-level data loading currently runs inside `useEffect` in pages rather than router loaders.

## Incremental Evolution Notes
Phase 6 will add `/cart` and `/checkout` routes under `RootLayout`.
