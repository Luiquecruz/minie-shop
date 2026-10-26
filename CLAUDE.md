# CLAUDE.md — Progressive Minie Shop

Context and guidelines for agents and developers working on this repository.

---

## 🎯 Project Overview
Progressive **Minie Shop** application built from scratch to review fundamental and advanced React concepts in an incremental and educational approach.

---

## 📌 Current Status & Execution Guidelines
- **Current Phase:** Phase 3 — PLP construction and product catalog.
- **Golden Rule (UI):** Emojis are strictly **forbidden** in the UI. Use vector SVG icons, proper typography, or equivalent graphic elements.
- **Language for Documentation & Code:** All documentation, code comments, and annotations must strictly be written in English.
- **Language/Stack:** **JavaScript (JSX)** exclusively in this initial phase.
  - *Note:* Migration/adoption of **TypeScript** will be carried out subsequently upon explicit user command.
- **Delivery Agility:** Fast and direct cycles. Avoid heavy browser subagents or redundant steps for targeted tasks. Focus on surgical edits, quick lint validation, and immediate feedback.
- **Crucial Rule for Agents:** Do not anticipate components, pages, or business rules unless the user explicitly requests the next step. Proceed step-by-step.
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
    │   ├── Navbar/        # Navigation bar with custom currency selector and cart
    │   ├── PriceBox/      # Reusable price component connected to currency engine
    │   └── ProductCard/   # Product card component (image, rating, price, actions)
    ├── data/
    │   └── products.js    # Mock base of 30 products processed by the pricing engine
    ├── hooks/
    │   └── useCurrency.js # Custom hook to consume and switch currencies (BRL, USD, EUR)
    ├── pages/
    │   └── ProductListingPage/ # PLP with search, category filters, sorting, and grid
    ├── services/
    │   └── api.js         # Simulated frontend-only API (search, filter, sort by final_price)
    ├── store/
    │   ├── index.js       # Redux Toolkit store configuration
    │   └── slices/
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
3. **Phase 3 (Current):** PLP construction, layout, and presentation components (Navbar, Dropdown, PriceBox, ProductCard, PLP with filters and grid) ✅
4. **Phase 4:** Global state and Hooks review (`useState`, `useEffect`, `useContext`, or Redux Toolkit for cart and persistence).
5. **Phase 5:** Incremental migration to TypeScript.
