# AGENTS.md — Progressive Minie Shop

Project constitution, context, and operational guidelines for AI agents and developers working in this repository.

---

## Project Overview

**Progressive Minie Shop** is an incremental e-commerce web application built from scratch with React and Vite to explore and apply fundamental and advanced React patterns in structured phases.

- **Current Phase:** Phase 5 completed — Floating Mini-Cart slide-over drawer with debounced stock validation, quantity guardrails, and `localStorage` persistence.
- **Next Planned Phases:**
  - **Phase 6:** Dedicated Cart page & Checkout flow.
  - **Phase 7:** Incremental migration from JavaScript/JSX to TypeScript.

---

## Tech Stack

| Layer | Technology | Version Range (`package.json`) | Notes |
| :--- | :--- | :--- | :--- |
| **Build Tool** | Vite (`@vitejs/plugin-react`) | `^8.3.4` (`^6.1.2`) | Dev server on port `5199` (`vite.config.js`) |
| **UI Library** | React & React DOM | `^19.3.1` | Exclusively JavaScript (`.js` / `.jsx`) until Phase 7 |
| **Global State** | `@reduxjs/toolkit` & `react-redux` | `^2.13.0` / `^9.3.0` | Multi-currency engine and shopping cart with `localStorage` |
| **Routing** | `react-router-dom` | `^7.18.4` | Declarative routing with `BrowserRouter` and `RootLayout` `<Outlet />` |
| **SEO / Head** | `react-helmet-async` | `^3.0.0` | Dynamic `<title>` and `<meta>` per route |
| **Linter** | Oxlint | `^1.88.0` | Configured via `.oxlintrc.json` (`react`, `oxc` plugins) |
| **Tests** | Not yet configured | — | Pending ADR before introducing test runner |

---

## Available Scripts

```bash
npm run dev      # Start Vite local dev server (http://localhost:5199, auto-open)
npm run build    # Build production bundle into dist/
npm run preview  # Preview production bundle locally
npm run lint     # Run Oxlint checks across the codebase
```

---

## Workspace Structure

```text
react-minieshop/
├── AGENTS.md                    # Root project constitution and agent instructions
├── .oxlintrc.json               # Oxlint configuration (react + oxc plugins)
├── vite.config.js               # Vite configuration (port 5199, host: true)
├── .agent/
│   ├── rules/                   # Domain-scoped agent rules
│   │   ├── architecture.md      # Always-on architectural & incremental ADR/SDD rules
│   │   ├── code-style.md        # Glob-scoped JS/JSX/CSS & UI quality conventions
│   │   ├── testing.md           # Verification, linting, build, and testing rules
│   │   └── git-workflow.md      # Conventional Commits & pre-commit checklist
│   └── agents/                  # Future project specialist agent definitions
├── docs/
│   ├── README.md                # Incremental documentation hub & maintenance guide
│   ├── architecture.md          # System architecture, routing & data-flow overview
│   ├── features.md              # Implemented features catalog
│   ├── components.md            # Layouts, pages, and reusable UI components
│   ├── hooks.md                 # Custom React hooks inventory
│   ├── store.md                 # Redux Toolkit store, slices & selectors
│   ├── services.md              # Simulated API service & product dataset
│   ├── utils.md                 # Pricing and multi-currency utility engines
│   ├── adr/                     # Incremental Architecture Decision Records
│   └── sdd/                     # Spec-Driven Development feature specifications
└── src/
    ├── assets/                  # Static image assets
    ├── components/              # Reusable UI components (Dropdown, MiniCart, Navbar, PriceBox, ProductCard, SearchBar)
    ├── data/                    # Mock dataset (products.js)
    ├── hooks/                   # Custom hooks (useCart, useCurrency, useFetch)
    ├── layouts/                 # Route layout shells (RootLayout)
    ├── pages/                   # Route pages (ProductListingPage, ProductDetailPage)
    ├── services/                # Frontend-only simulated API (api.js)
    ├── store/                   # Redux store & slices (cartSlice, currencySlice)
    ├── utils/                   # Pure business engines (currency.js, price.js)
    ├── App.jsx / App.css        # Router shell & app layout styles
    ├── index.css                # Design tokens (light/dark mode) & base styles
    └── main.jsx                 # Entry point with Redux Provider
```

---

## Core Execution & Quality Rules

1. **Strict English Policy:** All documentation, code comments, JSDoc blocks, ADRs, SDD specs, and UI copy must be written in English (product dataset items in `src/data/products.js` retain their catalog strings).
2. **No Emojis in UI:** Emojis are strictly forbidden in the user interface. Always use crisp inline vector SVGs, semantic typography, or CSS shapes.
3. **JavaScript First (Until Phase 7):** Write `.js` and `.jsx` files exclusively. TypeScript migration will occur incrementally in Phase 7 upon explicit user instruction.
4. **UI Quality Standard:** Every UI change must support light and dark mode via CSS tokens in `src/index.css`, respect container layout boundaries (`--container-max-width: 1280px`), and remain responsive across desktop, tablet, and mobile viewports.
5. **Delivery Agility & Validation Cadence:** Prefer surgical edits and immediate `npm run lint` + `npm run build` checks. Run browser validation at the conclusion of each implemented user flow or when explicitly requested by the user.
6. **Incremental Architecture & Documentation Protocol:**
   - New features or significant refactors should be preceded by an SDD specification in `docs/sdd/`.
   - New architectural choices (dependencies, state boundaries, test frameworks, TypeScript setup, routing shifts) must be recorded as an incremental ADR in `docs/adr/`.
   - Any addition or change to features, components, hooks, store slices, services, or utils must update the corresponding file in `docs/` and keep this `AGENTS.md` current.
