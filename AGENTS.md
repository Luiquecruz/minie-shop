# AGENTS.md — Progressive Minie Shop

Project constitution, context, and operational guidelines for AI agents and developers working in this monorepo.

---

## Project Overview

**Progressive Minie Shop** is an incremental full-stack e-commerce monorepo built in structured phases with a modular NestJS + Fastify backend, shared Zod contracts, React Email templates, and a React + TypeScript + Tailwind CSS v4 storefront.

- **Current Phase:** Pre-Design System Baseline completed after Phase 7 (`S08` APG header autocomplete + lazy `react-instantsearch` `/search` route, `R05` lazy PDP recommendations + inline Cart cross-sell over a frozen `cartSlice`, monorepo security/contract/API hardening, storefront boundary/a11y/CSRF enforcement, and full Tailwind CSS v4 + `light-dark()` semantic token unification).
- **Next Planned Phase:**
  - **Phase 8:** Design System extraction (`@minieshop/ui`, Storybook 10 + MCP, Changesets, and reusable accessible primitives).

---

## Tech Stack

| Layer | Technology | Version (`package.json`) | Notes |
| :--- | :--- | :--- | :--- |
| **Monorepo** | pnpm Workspaces + Turborepo | `pnpm@12.21.0`, `turbo@2.11.13`, Node `>=26` | Shared presets in `@minieshop/config` (`tsconfig.{base,node,web}.json`, ESLint, Prettier) |
| **Backend API & Worker** | NestJS 11 + Fastify 5 + Drizzle ORM | `@nestjs/* ^11`, `fastify ^5.2.2`, `drizzle-orm 0.45.4` | Modular monolith with 6 PostgreSQL 17 schemas (`pgvector`), transactional outbox, worker entrypoint, `sharp 0.35.5`, `argon2 0.45.2` |
| **Search & Infra** | Meilisearch + SeaweedFS + Ollama + Mailpit | Meilisearch `v1.57`, SeaweedFS `3.85`, Ollama `embeddinggemma-2` | Local zero-cost Docker Compose stack under `infra/` |
| **Shared Contracts** | `@minieshop/contracts` + Zod | `zod 4.6.7` | Strict server schemas (`.strict()`), tolerant client schemas (`.strip()`), `publint --strict` verified |
| **Transactional Email** | `@minieshop/email` | React Email | HTML + plain-text renderers with unit tests & ESLint |
| **Storefront Build & UI** | Vite + React + TypeScript | `vite ^8.3.4`, `react ^19.3.1`, `typescript 7.0.2` (web) / `5.9.3` (node) | Stack-pinned TypeScript (`ADR-0023`), strict mode (`allowJs: false`), dev server on port `5199` |
| **Styling & Theming** | Tailwind CSS v4 (`@tailwindcss/vite`) + `clsx` + `tailwind-merge` | `tailwindcss ^4.3.5`, `clsx ^2.1.1`, `tailwind-merge ^3.7.1` | Single CSS entrypoint (`apps/storefront/src/index.css`), 2-tier CSS-first `light-dark()` tokens, `html[data-theme]`, anti-FOUC script (`ADR-0024`) |
| **Server State & Search UI** | `@tanstack/react-query` + `react-instantsearch` | `^5.108.2` / `7.55.1` (lazy `/search` chunk only) | Cursor pagination (`useInfiniteQuery`), `keepPreviousData`, optimistic Favorites queue, `useCombobox` APG |
| **Global Client State** | `@reduxjs/toolkit` + `react-redux` | `^2.13.0` / `^9.3.0` | Pure `cartSlice` (frozen) & `currencySlice`, memoized `createSelector`, `createListenerMiddleware` `localStorage` persistence |
| **Routing & SEO** | `react-router-dom` + `react-helmet-async` | `^7.18.4` / `^3.0.0` | Canonical `/:category/:slug` PDP, `/search`, `/cart`, `<ErrorBoundary>` + lazy `<Suspense>`, single `<main>` in `RootLayout` |
| **Linting & Verification** | Oxlint (`storefront`) + ESLint (`api`, `contracts`, `email`) + Vitest + `vitest-axe` + Playwright | `oxlint ^1.88.0`, `vitest ^5.1.1`, `playwright 1.65.1` | `jsx-a11y`, `import/no-cycle`, storefront layer guards, backend `eslint-plugin-boundaries` + per-module DB schema rules |

---

## Browser Support Policy (`Baseline 2024+`)

The storefront explicitly targets **`Baseline 2024+`** evergreen browsers (`ADR-0024`):
- **Chrome / Edge:** `123+`
- **Safari:** `17.5+`
- **Firefox:** `128+` *(intersection of CSS `light-dark()` and Tailwind CSS v4 engine minimums)*

Modern CSS and HTML platform primitives (`light-dark()`, `color-scheme`, `@layer`, native `<dialog>.showModal()`, `IntersectionObserver`) are used directly without legacy polyfills.

---

## Available Scripts

```bash
pnpm dev:storefront                           # Start Vite storefront dev server on http://localhost:5199
pnpm dev:api                                  # Start NestJS API dev server on http://localhost:3001
pnpm typecheck                                # Strict TypeScript checks across all workspace packages
pnpm lint                                     # ESLint (api/contracts/email) + Oxlint (storefront)
pnpm test                                     # Unit & Vitest + vitest-axe suites across all packages
pnpm build                                    # Build contracts, email, API, and storefront production bundle
pnpm audit --audit-level=high                 # Blocking security audit gate (must report 0 high/critical)
pnpm --filter @minieshop/contracts lint:pkg   # Validate @minieshop/contracts exports via publint --strict
pnpm --filter @minieshop/api test:integration # Run API HTTP, search & security integration suite (PG + Meilisearch)
pnpm --filter @minieshop/storefront metrics   # Run Playwright metrics suite against live stack
```

---

## Workspace Structure

```text
react-minieshop/
├── AGENTS.md                           # Root project constitution and agent instructions
├── CONTRIBUTING.md                     # Contribution guide, branching, and PR workflow
├── package.json                        # Root pnpm + Turborepo workspace manifest
├── pnpm-workspace.yaml                 # Workspace packages + security overrides
├── turbo.json                          # Turborepo task dependency graph
├── .editorconfig                       # Shared whitespace & newline standard
├── .github/workflows/                  # Backend & Storefront CI pipelines (lint, typecheck, test, build, publint, audit)
├── .agent/
│   ├── rules/                          # Domain-scoped agent rules
│   │   ├── architecture.md             # Always-on architectural boundaries & ADR/SDD governance
│   │   ├── formatting-and-whitespace.md # Prettier/.editorconfig & empty-brace ({}) rule
│   │   ├── code-style.md               # TS/TSX, Tailwind v4, a11y & Oxlint/ESLint conventions
│   │   ├── testing.md                  # Verification gates, Vitest/axe, Playwright & CodeRabbit checklist
│   │   └── git-workflow.md             # Branch-per-spec, Conventional Commits & commit approval gate
│   └── agents/                         # Project specialist agent definitions & template
├── apps/
│   ├── api/                            # NestJS + Fastify modular monolith & outbox worker
│   │   ├── drizzle/                    # Versioned PostgreSQL 17 SQL migrations
│   │   ├── eslint.config.mjs           # Module barrel & per-schema DB import boundaries
│   │   ├── Dockerfile                  # Multi-stage development & compiled production image
│   │   └── src/
│   │       ├── common/                 # GlobalExceptionFilter, parseOutput, ETag, chaos middleware
│   │       ├── config/                 # Fail-fast Zod env validation
│   │       ├── database/schema/        # Module-owned Drizzle schemas (catalog, media, inventory, identity, platform, recommendations)
│   │       ├── modules/                # Domain modules exposing public index.ts barrels
│   │       └── worker/                 # Second entrypoint polling platform.outbox_events
│   └── storefront/                     # React 19 + Vite 8 + Tailwind CSS v4 SPA
│       ├── index.html                  # color-scheme meta + synchronous anti-FOUC theme script
│       ├── .oxlintrc.json              # Oxlint (react, jsx-a11y, oxc, typescript, import/no-cycle, layer guards)
│       ├── scripts/metrics/            # Playwright empirical metrics runner
│       └── src/
│           ├── components/             # Reusable UI components (Tailwind v4, zero legacy .css files)
│           ├── config/                 # Fail-fast Zod VITE_API_URL validation
│           ├── context/                # ProductRepository DI context & provider
│           ├── domain/                 # ProductRepository port & domain error helpers
│           ├── hooks/                  # Facade, query, combobox, intersection & theme hooks
│           ├── i18n/                   # Reactive EN + PT-BR dictionaries & I18nProvider
│           ├── infrastructure/         # HttpClient (CSRF + abort + chaos), repositories, queryStrings, instantSearchAdapter
│           ├── layouts/RootLayout/     # Persistent Navbar, single <main id="main-content">, Skip Link, Footer, MiniCart
│           ├── pages/                  # PLP, PDP, lazy SearchResultsPage, CartPage, NotFoundPage
│           ├── query/                  # TanStack QueryClient & typed query key factory
│           ├── routes/                 # Legacy /product/:id -> /:category/:slug redirects
│           ├── store/                  # Pure Redux slices (cart, currency), selectors & listener persistence
│           ├── test/                   # Vitest setup, <dialog> & IntersectionObserver mocks, catalog fixtures
│           ├── types/                  # Storefront-specific Cart & Currency domain types
│           ├── utils/                  # cn, currency metadata, integer-cents money formatting, Zod URL params
│           ├── App.tsx                 # BrowserRouter, ErrorBoundary & lazy Suspense routes
│           ├── index.css               # Single Tailwind v4 entrypoint & 2-tier light-dark() semantic tokens
│           └── main.tsx                # Composition root (HttpProductRepository, QueryClient, Redux, I18n)
├── packages/
│   ├── config/                         # Shared tsconfig.{base,node,web}.json, eslint.base.mjs, prettier.json
│   ├── contracts/                      # Shared Zod v4 DTOs (server .strict() & client .strip()) + publint
│   └── email/                          # React Email transactional templates + tests
├── infra/                              # Docker Compose stack (Postgres, Meilisearch, SeaweedFS, Ollama, Mailpit)
└── docs/                               # Living English docs, metrics, ADRs & SDD specs
```

---

## Core Execution & Quality Rules

1. **Strict English Policy:** All living documentation, code comments, JSDoc blocks, new ADRs, SDD specs, and default UI copy must be written in English. Explicit exceptions: the Portuguese i18n dictionary (`apps/storefront/src/i18n/pt-BR.ts`), catalog fixture product copy, and immutable historical PT-BR ADR bodies (`docs/adr/0002`–`0021`, where only status headers are updated).
2. **No Emojis in UI:** Emojis are strictly forbidden in the user interface. Always use crisp inline vector SVGs (`aria-hidden="true"` when decorative), semantic typography, or CSS shapes.
3. **Strict TypeScript First:** Write `.ts` and `.tsx` files exclusively (stack-pinned `5.9.3` for Node packages, `7.0.2` for storefront; `"strict": true`, `"allowJs": false`). Never use `any` (explicit or implicit); narrow `unknown` values with type guards.
4. **UI Quality & Token Standard:** Style `apps/storefront` exclusively with Tailwind CSS v4 semantic utilities backed by `light-dark()` tokens in `apps/storefront/src/index.css` (`@theme inline`) and `cn()`. Every UI change must support `System / Light / Dark` (`html[data-theme]`) with zero FOUC, respect the `1280px` container boundary, comply with WCAG / `vitest-axe`, and remain responsive across desktop, tablet, and mobile viewports.
5. **Delivery Agility & Validation Cadence:** Prefer surgical edits and immediate `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm audit --audit-level=high` checks. Run browser / Playwright validation at the conclusion of each implemented user flow or when explicitly requested.
6. **Incremental Architecture & Documentation Protocol:**
   - New features or significant refactors should be preceded by an SDD specification in `docs/sdd/`.
   - New architectural choices (dependencies, state boundaries, test frameworks, routing or styling shifts) must be recorded as an incremental ADR in `docs/adr/`.
   - Any design pattern introduced, refactored, or retired (frontend, backend, or contracts) **must** update `docs/design-patterns.md` in the same change set.
   - Any addition or change to features, components, hooks, store slices, services, or utils must update the corresponding file in `docs/` and keep this `AGENTS.md` current.
7. **Mandatory Branch-per-Spec Rule:**
   - Every SDD specification or feature increment **must** have its own dedicated Git branch (`feat/<slug>`, `fix/<slug>`, `refactor/<slug>`, `chore/<slug>`, `docs/<slug>`).
   - **Clean Branch Names (No SDD IDs):** Branch names must be clear, concise, and domain-focused (e.g., `feat/dedicated-cart-page`). Never include SDD prefixes or numbers (such as `sdd-0001`) in branch names.
   - Never start implementing a new spec on `main` or on another spec's existing branch. Check `git branch --show-current` first.
8. **Mandatory Review & Explicit Commit/Push Approval Gate (No Auto-Commit):**
   - Run local verification plus CodeRabbit CLI review (`coderabbit review --agent --uncommitted --include-untracked`) and resolve actionable findings before requesting commit/push approval.
   - **Never commit or push changes (`git commit`, `git push`) without explicit user approval** of both the approach and the resulting changes.
   - **Open PR Heightened Gate:** Especially when the current branch already has an open Pull Request, never commit or push fixes, refactors, or review responses autonomously—present the diagnosis/approach and local verification first, and wait for explicit approval before committing or pushing.
