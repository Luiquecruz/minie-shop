# AGENTS.md — Progressive Minie Shop

Project constitution, context, and operational guidelines for AI agents and developers working in this repository.

---

## Project Overview

**Progressive Minie Shop** is an incremental e-commerce web application built from scratch with React, TypeScript, and Vite to explore and apply fundamental and advanced React patterns in structured phases.

- **Current Phase:** Phase 7 — Storefront Search UI (`S08`: accessible APG `useCombobox` header autocomplete + lazy-loaded `react-instantsearch` `/search` route) & Recommendation Carousels (`R05`: lazy `IntersectionObserver` PDP blocks + inline Cart cross-sell over a frozen `cartSlice`).
- **Next Planned Phase:**
  - **Phase 8:** Design system & styling architecture evolution.

---

## Tech Stack

| Layer | Technology | Version Range (`package.json`) | Notes |
| :--- | :--- | :--- | :--- |
| **Build Tool** | Vite (`@vitejs/plugin-react`) | `^8.3.4` (`^6.1.2`) | Dev server on port `5199` (`vite.config.ts`) |
| **Language** | TypeScript | `^7.0.2` | Strict mode (`"strict": true`, `"allowJs": false`), extensionless bundler imports |
| **UI Library** | React & React DOM | `^19.3.1` | Authored strictly in `.ts` / `.tsx` |
| **Server State** | `@tanstack/react-query` | `^5.x` | Query caching (`staleTime`, `gcTime`), `keepPreviousData`, retries, optimistic Favorites mutation, Devtools (`DEV`) |
| **Global Client State** | `@reduxjs/toolkit` & `react-redux` | `^2.13.0` / `^9.3.0` | Multi-currency engine, shopping cart with `localStorage`, typed `store/hooks.ts` |
| **Routing** | `react-router-dom` | `^7.18.4` | Declarative routing with `BrowserRouter` and `RootLayout` `<Outlet />` |
| **SEO / Head** | `react-helmet-async` | `^3.0.0` | Dynamic `<title>` and `<meta>` per route |
| **Linter** | Oxlint | `^1.88.0` | Configured via `.oxlintrc.json` (`react`, `oxc`, `typescript` plugins, `typescript/no-explicit-any: "error"`) |
| **Tests** | Vitest + Testing Library | `^5.1.1` (`jsdom`) | Reducer, `createSelector` memoization & React `<Profiler>` tests (`npm test`) |

---

## Available Scripts

```bash
pnpm dev           # Start monorepo dev servers via Turbo
pnpm test          # Run API contract/unit tests and storefront Vitest + vitest-axe suites
pnpm typecheck     # Run strict TypeScript compiler checks across all packages
pnpm lint          # Run ESLint & Oxlint checks across the workspace
pnpm build         # Build contracts, email, API, and storefront production bundle
pnpm --filter @minieshop/storefront metrics  # Run Playwright metrics suite against live stack
```

---

## Workspace Structure

```text
react-minieshop/
├── AGENTS.md                    # Root project constitution and agent instructions
├── CONTRIBUTING.md              # Contribution guide, branching, and PR workflow
├── .oxlintrc.json               # Oxlint configuration (react + oxc + typescript plugins)
├── tsconfig.json                # Strict TypeScript app configuration (allowJs: false)
├── tsconfig.node.json           # TypeScript config for vite.config.ts
├── vite.config.ts               # Vite configuration (port 5199, host: true)
├── .agent/
│   ├── rules/                   # Domain-scoped agent rules
│   │   ├── architecture.md      # Always-on architectural & incremental ADR/SDD rules
│   │   ├── code-style.md        # Glob-scoped TS/TSX/CSS & UI quality conventions
│   │   ├── testing.md           # Verification, typecheck, linting, build, and testing rules
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
    ├── components/              # Reusable UI components (ApiDebugFab, Dropdown, MiniCart, Navbar, Pagination, PriceBox, ProductCard, SearchBar)
    ├── pages/                   # Route pages (ProductListingPage, ProductDetailPage, CartPage)
    ├── query/                   # TanStack Query client & typed key factory (queryClient.ts, queryKeys.ts)
    ├── services/                # Frontend-only simulated API & error simulator (api.ts)
    ├── store/                   # Redux store, typed hooks, pure slices, memoized selectors & persistence (hooks.ts, persistence/, selectors/, slices/)
    ├── test/                    # Vitest test setup (setup.ts)
    ├── types/                   # Shared domain types & interfaces (api.ts, cart.ts, currency.ts, product.ts, index.ts)
    ├── utils/                   # Pure business engines (currency.ts, price.ts)
    ├── App.tsx / App.css        # Router shell & app layout styles
    ├── index.css                # Design tokens (light/dark mode) & base styles
    ├── main.tsx                 # Entry point with QueryClientProvider & Redux Provider
    └── vite-env.d.ts            # Vite client ambient type declarations
```

---

## Core Execution & Quality Rules

1. **Strict English Policy:** All documentation, code comments, JSDoc blocks, ADRs, SDD specs, and UI copy must be written in English (product dataset items in `src/data/products.ts` retain their catalog strings).
2. **No Emojis in UI:** Emojis are strictly forbidden in the user interface. Always use crisp inline vector SVGs, semantic typography, or CSS shapes.
3. **Strict TypeScript First:** Write `.ts` and `.tsx` files exclusively using extensionless relative imports (`moduleResolution: "bundler"`). Never use `any` (explicit or implicit); narrow `unknown` values with type guards.
4. **UI Quality Standard:** Every UI change must support light and dark mode via CSS tokens in `src/index.css`, respect container layout boundaries (`--container-max-width: 1280px`), and remain responsive across desktop, tablet, and mobile viewports.
5. **Delivery Agility & Validation Cadence:** Prefer surgical edits and immediate `npm run typecheck`, `npm run lint`, and `npm run build` checks. Run browser validation at the conclusion of each implemented user flow or when explicitly requested by the user.
6. **Incremental Architecture & Documentation Protocol:**
   - New features or significant refactors should be preceded by an SDD specification in `docs/sdd/`.
   - New architectural choices (dependencies, state boundaries, test frameworks, routing shifts) must be recorded as an incremental ADR in `docs/adr/`.
   - Any addition or change to features, components, hooks, store slices, services, or utils must update the corresponding file in `docs/` and keep this `AGENTS.md` current.
7. **Mandatory Branch-per-Spec Rule:**
   - Every SDD specification or feature increment **must** have its own dedicated Git branch (`feat/<slug>`, `fix/<slug>`, `refactor/<slug>`).
   - **Clean Branch Names (No SDD IDs):** Branch names must be clear, concise, and domain-focused (e.g., `feat/dedicated-cart-page`). Never include SDD prefixes or numbers (such as `sdd-0001`) in branch names.
   - Never start implementing a new spec on `main` or on another spec's existing branch. Check `git branch --show-current` first: continue on the spec's dedicated branch if already checked out, otherwise create/checkout a new dedicated branch before writing code.
