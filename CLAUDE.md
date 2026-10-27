# CLAUDE.md — Progressive Minie Shop

Context and guidelines for agents and developers working on this repository.

---

## 🎯 Project Overview
Progressive **Minie Shop** application built from scratch to review fundamental and advanced React concepts in an incremental and educational approach.

---

## 📌 Current Status & Execution Guidelines
- **Current Phase:** Phase 5 — Mini-Cart floating slide-over drawer with debounced quantity validation, stock guardrails, and persistent storage.
- **Golden Rule (UI):** Emojis are strictly **forbidden** in the UI. Use vector SVG icons, proper typography, or equivalent graphic elements.
- **Language for Documentation & Code:** All documentation, code comments, and annotations must strictly be written in English.
- **Language/Stack:** **JavaScript (JSX)** exclusively in this initial phase.
  - *Note:* Migration/adoption of **TypeScript** will be carried out subsequently upon explicit user command.
- **Delivery Agility:** Fast and direct cycles. Avoid heavy browser subagents or redundant steps for targeted tasks. Focus on surgical edits, quick lint validation, and immediate feedback.
- **Browser Validation Cadence:** Browser validation must strictly be performed at the conclusion of each implemented flow, or whenever explicitly requested by the user.
- **UI Quality Standard:** Dark mode support, visual identity consistency, design tokens (current CSS variables and future formal tokens), container layout boundaries, and full responsiveness (desktop, tablet, mobile) must ALWAYS be considered and verified in every UI implementation.
- **Maintenance of this file:** Whenever new architecture decisions, dependencies, or conventions are introduced, update this `CLAUDE.md` file.

---

## 🛠️ Installed Tech Stack
- **Build Tool:** [Vite](https://vite.dev/) `v8.x`
- **Main Library:** [React](https://react.dev/) `v19.x` & `react-dom`
- **Global State Management:** [`@reduxjs/toolkit`](https://redux-toolkit.js.org/) & [`react-redux`](https://react-redux.js.org/) (used in multi-currency engine and cart)
- **Routing:** [`react-router-dom`](https://reactrouter.com/) `v7.x`
- **Header / SEO Management:** [`react-helmet-async`](https://github.com/staylor/react-helmet-async) `v3.x`
- **Linter:** [Oxlint](https://oxc.rs/)

---

## 🚀 Available Scripts
```bash
npm run dev      # Start Vite local development server
npm run build    # Build production bundle
npm run preview  # Preview production bundle locally
npm run lint     # Run oxlint checks
```

---

## 📁 File Structure
```text
react-minieshop/
├── CLAUDE.md              # Documentation and context tracking for agents
├── index.html             # HTML entry point
├── package.json           # Dependencies and scripts
├── vite.config.js         # Vite configuration with React plugin
└── src/
    ├── assets/            # Static assets
    ├── components/
    │   ├── Dropdown/      # Reusable custom dropdown for cross-system visual unity
    │   ├── MiniCart/      # Floating slide-over drawer with item list, debounced qty, guardrails, totals & CTAs
    │   ├── Navbar/        # Navigation bar with search, currency selector, and cart trigger with badge
    │   ├── PriceBox/      # Reusable price component connected to currency engine
    │   ├── ProductCard/   # Product card component (image, rating, price, actions)
    │   └── SearchBar/     # Search input with autocomplete dropdown, keyboard nav, and highlight
    ├── data/
    │   └── products.js    # Mock base of 30 products processed by the pricing engine
    ├── hooks/
    │   ├── useCart.js     # Custom hook for cart state and actions
    │   ├── useCurrency.js # Custom hook to consume and switch currencies (BRL, USD, EUR)
    │   └── useFetch.js    # Data fetching hook with AbortController, debounce, and effect cleanup
    ├── layouts/
    │   └── RootLayout/    # Canonical Layout Route component with <Outlet /> (Navbar, footer, and MiniCart)
    ├── pages/
    │   ├── ProductDetailPage/ # PDP with open masonry gallery, dynamic Helmet, tabs, floating CTA
    │   └── ProductListingPage/# PLP with search, category filters, sorting, and grid
    ├── services/
    │   └── api.js         # Simulated frontend-only API (search, filter, sort, related, stock validation)
    ├── store/
    │   ├── index.js       # Redux Toolkit store configuration
    │   └── slices/
    │       ├── cartSlice.js     # Cart slice with localStorage persistence, stock guardrails, and warnings
    │       └── currencySlice.js # Currency slice with localStorage persistence
    ├── utils/
    │   ├── currency.js    # Multi-currency engine (exchange rates, conversion, and Intl formatting)
    │   └── price.js       # Pricing calculation engine (calculatePrice and formatCurrency)
    ├── App.css            # Layout styles (shell, content, footer)
    ├── App.jsx            # Shell with BrowserRouter, HelmetProvider, and routes
    ├── index.css          # Design system with CSS tokens (light/dark mode)
    └── main.jsx           # React entry point with Redux Provider
```

---

## 🗺️ Progressive Evolution Roadmap
1. **Phase 1:** Clean project initialization (Vite + React JS + React Router + React Helmet) ✅
2. **Phase 2:** Base routing and providers (`BrowserRouter`, `HelmetProvider`, `Provider`) ✅
3. **Phase 3:** PLP construction, layout, and presentation components (Navbar, Dropdown, PriceBox, ProductCard, PLP) ✅
4. **Phase 4:** PDP construction (dynamic `/product/:id` route, Helmet metadata, open masonry gallery, mobile peek swipe, product info, priceBox, 3-tab system, floating action bar, related products) ✅
5. **Phase 5 (Current):** Mini-Cart drawer (floating drawer, item listing, qty controls with debounced validation and stock guardrails, localStorage persistence, subtotal/total calculation, checkout and full cart placeholder CTAs) ✅
6. **Phase 6:** Dedicated Cart page & Checkout flow.
7. **Phase 7:** Incremental migration to TypeScript.
