# ADR-0001: Vite 8 + React 19 (JavaScript/JSX) with Oxlint Baseline

- **Status:** Partially Superseded by [ADR-0006](./0006-incremental-typescript-migration.md)
- **Date:** 2026-10-23
- **Phase:** Phase 1

## Context
Progressive Minie Shop is an educational, incrementally developed e-commerce application focused on reviewing React fundamentals and advanced patterns before introducing static type complexity. The project needed a fast build/dev tool, modern React runtime, and low-overhead linter.

## Decision
- Use **Vite `^8.3.4`** (`@vitejs/plugin-react` `^6.1.2`) configured in `vite.config.js` (dev server port `5199`, `host: true`).
- Use **React `^19.3.1`** and **React DOM `^19.3.1`** authored exclusively in **JavaScript (`.js` / `.jsx`)** using ES Modules (`"type": "module"`).
- Use **Oxlint `^1.88.0`** configured in `.oxlintrc.json` with `["react", "oxc"]` plugins, enforcing `react/rules-of-hooks: "error"` and `react/only-export-components: "warn"`.

## Alternatives Considered
- **TypeScript from Phase 1:** Deferred to Phase 7 so initial phases focus purely on React state, hooks, routing, and UI architecture without type-system boilerplate.
- **ESLint:** Replaced by Oxlint for millisecond-scale lint feedback (`npm run lint`) during rapid iterations.

## Consequences
### Positive
- Instant dev server startup and fast production bundling.
- Very fast lint checks with zero config bloat.

### Negative / Trade-offs
- No compile-time type safety until Phase 7; compensated partially via JSDoc parameter annotations in utilities, hooks, services, and components.

## Incremental Evolution Notes
Partially superseded in the Pre-Phase 6 milestone by [ADR-0006](./0006-incremental-typescript-migration.md), which migrated all `.js`/`.jsx` source files to strict TypeScript (`.ts`/`.tsx`), added `tsconfig.json` / `tsconfig.node.json`, and switched relative imports to extensionless bundler resolution while keeping Vite 8, React 19, and Oxlint.
