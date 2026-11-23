# Contributing to Progressive Minie Shop

Thank you for contributing to **Progressive Minie Shop**! This repository is built incrementally in structured phases with strict attention to clean React architecture, accessibility, and living documentation.

Please read [AGENTS.md](./AGENTS.md) and the rules under [`.agent/rules/`](./.agent/rules/) before opening a Pull Request.

---

## 1. Local Development Setup

```bash
npm install
npm run dev      # Starts Vite dev server at http://localhost:5199
```

### Available Scripts

| Script | Purpose |
| :--- | :--- |
| `npm run dev` | Start local Vite dev server (port `5199`) |
| `npm run typecheck` | Run strict TypeScript checks (`tsc --noEmit`) |
| `npm run lint` | Run Oxlint across the codebase (`0` warnings/errors required) |
| `npm run build` | Typecheck and build production bundle into `dist/` |
| `npm run preview` | Preview the production bundle locally |

---

## 2. Contribution Workflow

1. **Create a Branch from `main`:**
   Use a descriptive prefix matching your change:
   - `feat/<feature-slug>`
   - `fix/<bug-slug>`
   - `refactor/<scope-slug>`
   - `docs/<topic-slug>`
   - `chore/<task-slug>`
   - `test/<scope-slug>`

2. **Spec-Driven Development (SDD) & ADRs:**
   - **New Features:** Draft or reference an SDD spec in [`docs/sdd/`](./docs/sdd/README.md) before implementation.
   - **Architectural Decisions:** Record any new dependency, state boundary, routing shift, or tooling change as a sequential ADR in [`docs/adr/`](./docs/adr/README.md).

3. **Code & UI Standards:**
   - **English Only:** All code, comments, JSDoc blocks, commit messages, PR descriptions, and documentation must be written in English.
   - **Language & Stack:** Write strict `.ts` and `.tsx` files exclusively with extensionless relative imports (`moduleResolution: "bundler"`) and zero `any` types.
   - **Design Tokens & Dark Mode:** Use CSS custom properties from [`src/index.css`](./src/index.css) and verify both Light and Dark themes across desktop, tablet, and mobile viewports.

4. **Commit Messages (Conventional Commits):**
   ```text
   <type>(<optional-scope>): <imperative concise summary in English>
   ```
   - **Allowed types:** `feat`, `fix`, `refactor`, `docs`, `chore`, `test`
   - **Common scopes:** `plp`, `pdp`, `cart`, `search`, `currency`, `navbar`, `ui`, `store`, `api`, `docs`, `adr`, `sdd`, `agent`
   - **Examples:**
     - `feat(cart): add shipping estimator to mini-cart`
     - `fix(search): prevent stale dropdown flicker on rapid clear`
     - `docs(adr): record vitest adoption decision`

5. **Update Relevant Documentation:**
   Keep [`docs/`](./docs/README.md), ADRs, and SDD specs updated when applicable, and update [`AGENTS.md`](./AGENTS.md) if the stack, scripts, or phase status changes.

6. **Verify Before Opening a PR:**
   - Typecheck passes with **0 errors** (`npm run typecheck`).
   - Lint passes with **0 warnings and 0 errors** (`npm run lint`).
   - Build succeeds without errors (`npm run build`).
   - Browser validation is performed for affected UI flows (desktop & mobile, Light & Dark modes).
   - Pull Request contains **at most 100 changed files**; split larger changes into smaller sequential or stacked PRs.

7. **Open a Pull Request:**
   Fill out [`.github/pull_request_template.md`](./.github/pull_request_template.md) completely and use a Conventional Commit style title for the PR.
