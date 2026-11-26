# ADR-0023: Monorepo Package Boundaries, Stack-Pinned TypeScript, and Publish-Ready Contracts

- **Status:** Accepted
- **Date:** 2026-11-26
- **Phase:** Pre-Phase 8 Hardening (`chore/monorepo-security-and-api-hardening`)
- **Extends:** [ADR-0016](./0016-monorepo-pnpm-workspaces-turborepo.md)

## Context

During the pre-Design System architectural validation (`D-01`, `D-08`, `D-09`, `D-10`), four monorepo package boundary issues were confirmed:

1. **Compiler drift across workspaces:** Loose semver ranges (`^5.8.2`, `5.8.2`, `^7.0.2`) resolved three distinct TypeScript versions (`5.8.2`, `5.9.3`, `7.0.2`) in `pnpm-lock.yaml`, while `@typescript-eslint` caps backend packages at `typescript <6.1.0`.
2. **Inconsistent `tsconfig` inheritance:** `packages/email` bypassed `@minieshop/config` and lacked lint/test scripts, while `apps/api/tsconfig.json` compiled test files into `dist/`.
3. **Contract boundary leaks & security advisories:** `@minieshop/contracts` exposed backend-internal `searchIndexDocumentSchema` in its public root barrel, omitted explicit subpath exports (`./search/public`, `./recommendations/public`, `./identity/client`), lacked `files`/`publint` validation, and carried duplicated/vulnerable `zod` (`3.24.2` / `3.25.76` affected by `GHSA-mrhx-c7xc-m3w5`).
4. **Module DB schema boundary gap in `apps/api`:** `src/database/**` was grouped under `app-shell` in `eslint-plugin-boundaries`, allowing `MediaService` to write directly to `catalog.product_images` without triggering a lint error.

## Decision

1. **Stack-Pinned TypeScript & Shared `tsconfig` Presets (`@minieshop/config`):**
   - Keep `packages/config/tsconfig.base.json` restricted to strict compiler options valid across both TypeScript `5.9.x` and `7.x`.
   - Publish stack-specific presets: `@minieshop/config/tsconfig.node.json` (`NodeNext`) and `@minieshop/config/tsconfig.web.json` (`ESNext` + `bundler` + `react-jsx`).
   - Pin exact TypeScript versions per workspace stack (no `^`): **`5.9.3`** for backend/ESLint packages (`apps/api`, `packages/contracts`, `packages/email`) and **`7.0.2`** for frontend/Oxlint packages (`apps/storefront` and future `@minieshop/ui`).
   - Separate production emission (`tsconfig.build.json`, excluding `*.test.ts`/`*.spec.ts`/`src/test/**`) from full workspace typechecking and `tsx` execution (`tsconfig.json`).

2. **Package Dependency & Boundary Rules (`packages/*`):**
   - **Design System topology (Phase 8 target):** A single `@minieshop/ui` package with an isolated `./tokens` subpath (zero React dependency) and `react`/`react-dom` declared strictly in `peerDependencies`; domain composites remain app-local until a second consumer app exists.
   - **`@minieshop/email`:** Retains `react` in `dependencies` intentionally because it exports pure async HTML/text rendering functions for a non-React consumer (`apps/api`), while adopting `@minieshop/config/tsconfig.node.json`, ESLint, and unit tests.
   - **`@minieshop/contracts`:** Restricted strictly to cross-app HTTP API contracts. `searchIndexDocumentSchema` / `SearchIndexDocument` move to `apps/api/src/modules/catalog/search-index-document.ts`. Subpaths (`./search/public`, `./recommendations/public`, `./identity/client`), `"files": ["dist"]`, `"sideEffects": false`, unit tests, and `publint --strict` validation are enforced in CI (including cross-stack `.d.ts` verification under `apps/storefront`'s TS `7.0.2`).

3. **Security Pinning & Blocking Audit Gate:**
   - Migrate and pin `zod` to `4.6.7` across `@minieshop/contracts`, `@minieshop/api`, and `@minieshop/storefront`, upgrade `drizzle-orm@0.45.4`, `sharp@0.35.5`, `drizzle-kit@0.31.11`, and enforce `handlebars >=4.7.10` and `esbuild >=0.25.0` via `pnpm-workspace.yaml` `overrides`.
   - Convert `pnpm audit --audit-level=high` into a blocking CI gate and remove duplicate `test:security` execution in `backend.yml`.

4. **Physical Enforcement of Per-Module DB Schema Ownership (`ADR-0006`):**
   - Split `src/database/schema/*.ts` out of `app-shell` in `apps/api/eslint.config.mjs` so each backend module may import only its own schema file (`{ schema: '${from.module}' }`).
   - Move `product_images` linking from `MediaService` to `CatalogService.linkProductImage()`.

## Consequences

### Positive
- Deterministic two-stack compiler policy with zero hoisting drift and verified TS `5.9.3` → `7.0.2` `.d.ts` compatibility on every PR.
- Zero `HIGH`/`CRITICAL` dependency vulnerabilities enforced as a blocking CI gate.
- `ADR-0006` per-module database schema ownership is now enforced mechanically by ESLint.
- Clean `dist/` outputs and production multi-stage Docker build for `apps/api` using Turbo dependency graph orchestration.

### Trade-offs
- Maintaining two TypeScript lines requires keeping `packages/contracts` declarations verified against TS `7.x` in CI and limiting frontend packages (`storefront`, future `@minieshop/ui`) to Oxlint rules (which natively include `jsx-a11y`, `import/no-cycle`, and `no-restricted-imports`).
