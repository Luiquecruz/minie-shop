---
trigger: model_decision
description: "Git branching, Conventional Commits standard, and pre-commit/PR verification checklist."
---

# Git Workflow & Commit Conventions

## 0. Mandatory Commit & Push Approval Gate
- **Never commit or push without explicit user approval:** Never run `git commit` or `git push` automatically after edits, test fixes, or code review adjustments. Validate locally first, present the changes, and wait for the user's explicit authorization to commit or push.
- **Strict Gate for Open Pull Requests:** Whenever an open Pull Request already exists for the current branch, every new fix or modification requires prior validation of the approach and changes by the user before committing or updating the remote PR branch.

## 1. Commit Message Standard
Follow **Conventional Commits** matching the repository history:

```text
<type>(<optional-scope>): <imperative concise summary in English>
```

### Allowed Types
- `feat`: New user-facing feature or phase capability
- `refactor`: Code restructuring without changing external behavior
- `fix`: Bug fix in UI, state, routing, API, or business logic
- `docs`: Documentation updates (`AGENTS.md`, `CONTRIBUTING.md`, `docs/`, `docs/adr/`, `docs/sdd/`, `.agent/`)
- `chore`: Tooling, dependencies, CI, Docker, or maintenance tasks
- `test`: Adding or updating automated tests

### Common Scopes
`storefront`, `api`, `contracts`, `email`, `config`, `infra`, `plp`, `pdp`, `cart`, `search`, `currency`, `theme`, `navbar`, `ui`, `store`, `docs`, `adr`, `sdd`, `agent`

### Examples from Project History
- `chore(api): harden monorepo dependencies, contracts, and API boundaries`
- `refactor(storefront): enforce layer boundaries, CSRF, WCAG controls, and Oxlint gates`
- `feat(storefront): adopt Tailwind CSS v4, semantic light-dark tokens, and theme toggle`
- `docs(governance): align living documentation, agent rules, and historical ADR statuses`

## 2. Branching Model (Mandatory Branch-per-Spec Rule)
- **Dedicated Branch per Spec/Task:** Every SDD specification (`docs/sdd/NNNN-*.md`), feature increment, or fix **must** be developed in its own dedicated branch. Never implement a new spec on `main` or reuse an unrelated/previous spec's branch.
- **Verify Before Editing:** Before creating or modifying files for a spec, inspect `git branch --show-current`. If you are already on that spec's dedicated branch, continue working on it; otherwise create and switch to a new dedicated branch from `main`.
- **Clean Branch Naming (No SDD Identifiers):** Branch names must be clear, concise, and objective—**never** include `sdd`, SDD numbers, or spec IDs (e.g., avoid `feat/sdd-0001-cart-page`; use `feat/dedicated-cart-page`).
- Keep `main` always buildable (`pnpm build`), lint-clean (`pnpm lint`), and test-green (`pnpm test`).
- Create descriptive branches per task or SDD spec:
  - `feat/<feature-slug>`
  - `fix/<bug-slug>`
  - `refactor/<scope-slug>`
  - `chore/<task-slug>`
  - `docs/<topic-slug>`

## 3. Pull Request & Contribution Standard
- Follow [`CONTRIBUTING.md`](../../CONTRIBUTING.md) for local setup, branching, Conventional Commits, and review readiness.
- Use [`.github/pull_request_template.md`](../../.github/pull_request_template.md) for every Pull Request, with a Conventional Commit formatted PR title.

## 4. Pre-Commit / Definition of Done Checklist
Before requesting approval to commit and open/update a PR:
1. Run `pnpm typecheck` -> `0` errors.
2. Run `pnpm lint` -> `0` errors, `0` warnings.
3. Run `pnpm test` -> `0` failures (and API integration tests when backend code changed).
4. Run `pnpm build` -> clean builds across all workspace packages.
5. Run `pnpm audit --audit-level=high` -> `0` high/critical advisories, and `git diff --check` -> clean whitespace.
6. Run `coderabbit review --agent --uncommitted --include-untracked` and resolve all actionable findings.
7. Update `docs/design-patterns.md` and relevant `docs/` inventories (`features.md`, `components.md`, `hooks.md`, `store.md`, `services.md`, `utils.md`, `db-model.md`, `api.md`) for any added or modified code.
8. Add or update an incremental ADR in `docs/adr/` if an architectural decision was made (and update SDD status in `docs/sdd/` when completing a specified feature).
9. Update `AGENTS.md` if the tech stack, scripts, phase status, or workspace structure changed.
