# Contributing to Progressive Minie Shop

Thank you for contributing to **Progressive Minie Shop**! This monorepo is built incrementally in structured phases with strict attention to modular backend boundaries, clean React architecture, WCAG accessibility, security, and living documentation.

Please read [AGENTS.md](./AGENTS.md) and the rules under [`.agent/rules/`](./.agent/rules/) before opening a Pull Request.

---

## 1. Local Development Setup

### Prerequisites
- **Node.js** `>= 26` (see `.nvmrc`)
- **pnpm** `12.21.0` (`corepack enable` or `packageManager` field)
- **Docker** / OrbStack (for local PostgreSQL 17 + `pgvector`, Meilisearch, SeaweedFS, Ollama, and Mailpit via `infra/compose.yaml`)

### Fresh Checkout (Recommended Containerized Stack)

```bash
cp .env.example .env
docker compose up -d --build                      # Starts postgres, storage, search, mailpit, migrations, api, worker & storefront
docker compose --profile seed run --rm seed       # Seeds sample catalog, media & default dev admin (first run)
```

*(Or run `make -C infra reset` for a clean one-command reset that migrates, seeds, and drains the outbox.)*

### Host Workspace Setup (Tests, Linting & Hybrid Dev)

```bash
pnpm install
pnpm build
pnpm dev:storefront  # Starts Vite + Tailwind v4 storefront at http://localhost:5199
```

> **Running `pnpm dev:api` directly on the host:** Keep the Docker infrastructure services running (`postgres`, `storage`, `search`, `mailpit`), ensure migrations are applied (`pnpm --filter @minieshop/api db:migrate`), and point `DATABASE_URL`, `S3_ENDPOINT`, `MEILI_HOST`, and `EMBEDDINGS_BASE_URL` at `127.0.0.1` instead of Docker service hostnames. See [README.md](./README.md) for the complete local and AI-profile setup walkthrough.

### Available Workspace Scripts

| Script | Purpose |
| :--- | :--- |
| `pnpm dev:storefront` | Start local Vite storefront dev server (`http://localhost:5199`) |
| `pnpm dev:api` | Start local NestJS API dev server (`http://localhost:3001`) |
| `pnpm typecheck` | Run strict TypeScript checks across all workspace packages via Turborepo |
| `pnpm lint` | Run ESLint (`api`, `contracts`, `email`) and Oxlint (`storefront`) (`0` warnings/errors required) |
| `pnpm test` | Run unit, contract, email, and storefront Vitest + `vitest-axe` suites |
| `pnpm build` | Build `@minieshop/contracts`, `@minieshop/email`, `@minieshop/api`, and `@minieshop/storefront` |
| `pnpm audit --audit-level=high` | Blocking security audit gate (`0` high/critical vulnerabilities) |
| `pnpm --filter @minieshop/contracts lint:pkg` | Validate published package exports via `publint --strict` |
| `pnpm --filter @minieshop/api test:integration` | Run backend HTTP, search, and security integration tests (Postgres + Meilisearch) |
| `pnpm --filter @minieshop/storefront metrics` | Run Playwright performance, bundle-split, and CLS metrics against the live stack |

---

## 2. Contribution Workflow

1. **Create a Dedicated Branch from `main`:**
   Use a clean, domain-focused prefix (never include SDD IDs in branch names):
   - `feat/<feature-slug>`
   - `fix/<bug-slug>`
   - `refactor/<scope-slug>`
   - `chore/<task-slug>`
   - `docs/<topic-slug>`
   - `test/<scope-slug>`

2. **Spec-Driven Development (SDD) & ADRs:**
   - **New Features:** Draft or reference an SDD spec in [`docs/sdd/`](./docs/sdd/README.md) before implementation.
   - **Architectural Decisions:** Record any new dependency, state boundary, styling/tooling shift, or backend module decision as a sequential ADR in [`docs/adr/`](./docs/adr/README.md). Never rewrite historical ADR bodies—update status headers only when superseding.

3. **Code, Styling & Accessibility Standards:**
   - **English Only:** All code, comments, JSDoc blocks, commit messages, PR descriptions, new ADRs, and living documentation must be written in English (Portuguese storefront copy belongs exclusively in `apps/storefront/src/i18n/pt-BR.ts`).
   - **Strict TypeScript:** Author `.ts` and `.tsx` files exclusively (`"strict": true`, `"allowJs": false`, zero `any`). Respect stack-pinned TypeScript (`5.9.3` for Node packages, `7.0.2` for storefront) and ESLint/Oxlint layer boundary rules.
   - **Tailwind CSS v4 & `Baseline 2024+` (`ADR-0024`):** Style storefront UI with Tailwind CSS v4 utilities, `cn()`, and `light-dark()` semantic tokens in [`apps/storefront/src/index.css`](./apps/storefront/src/index.css). Verify `System`, `Light`, and `Dark` themes (with zero FOUC) across desktop, tablet, and mobile viewports.
   - **Formatting:** Follow [`.editorconfig`](./.editorconfig) and [`packages/config/prettier.json`](./packages/config/prettier.json) (no spaces inside empty braces: `{}`).
   - **Zero Emojis in UI:** Use crisp inline SVG icons or semantic typography.

4. **Commit Messages (Conventional Commits):**
   ```text
   <type>(<optional-scope>): <imperative concise summary in English>
   ```
   - **Allowed types:** `feat`, `fix`, `refactor`, `docs`, `chore`, `test`
   - **Common scopes:** `storefront`, `api`, `contracts`, `email`, `config`, `infra`, `plp`, `pdp`, `cart`, `search`, `currency`, `theme`, `navbar`, `ui`, `store`, `docs`, `adr`, `sdd`, `agent`
   - **Examples:**
     - `feat(storefront): adopt Tailwind CSS v4, semantic light-dark tokens, and theme toggle`
     - `fix(search): convert multi-currency price bounds before Meilisearch query`
     - `docs(adr): record monorepo package boundaries and stack TypeScript pinning`

5. **Update Living Documentation:**
   Keep [`docs/design-patterns.md`](./docs/design-patterns.md), [`docs/`](./docs/README.md) inventories, ADRs, SDD specs, and [`AGENTS.md`](./AGENTS.md) synchronized in the same PR.

6. **Verify Before Opening a PR:**
   - `pnpm typecheck` passes with **0 errors**.
   - `pnpm lint` passes with **0 warnings and 0 errors**.
   - `pnpm test` passes with **0 failures** (plus API integration tests when backend code changes).
   - `pnpm build` succeeds across all workspace packages.
   - `pnpm audit --audit-level=high` reports **0** high/critical vulnerabilities and `git diff --check` is clean.
   - Browser / Playwright validation is performed for affected storefront UI flows (desktop, tablet, mobile; Light & Dark modes).

7. **Open a Pull Request:**
   Fill out [`.github/pull_request_template.md`](./.github/pull_request_template.md) completely and use a Conventional Commit formatted PR title.
