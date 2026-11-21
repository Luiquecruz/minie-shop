---
trigger: model_decision
description: "Git branching, Conventional Commits standard, and pre-commit/PR verification checklist."
---

# Git Workflow & Commit Conventions

## 1. Commit Message Standard
Follow **Conventional Commits** matching the repository history:

```text
<type>(<optional-scope>): <imperative concise summary in English>
```

### Allowed Types
- `feat`: New user-facing feature or phase capability
- `refactor`: Code restructuring without changing external behavior
- `fix`: Bug fix in UI, state, routing, or business logic
- `docs`: Documentation updates (`AGENTS.md`, `docs/`, `docs/adr/`, `docs/sdd/`, `.agent/`)
- `chore`: Tooling, dependencies, configuration, or maintenance tasks
- `test`: Adding or updating automated tests

### Common Scopes
`plp`, `pdp`, `cart`, `search`, `currency`, `navbar`, `ui`, `store`, `api`, `docs`, `adr`, `sdd`, `agent`

### Examples from Project History
- `feat(cart): implement floating mini-cart drawer with stock validation`
- `feat(search): implement search bar with autocomplete and useFetch hook`
- `feat(pdp): implement product detail page and canonical declarative routing`
- `refactor(plp): streamline toolbar with single-line category badges and sort`
- `docs: translate documentation, comments, and labels to English`

## 2. Branching Model (Mandatory Branch-per-Spec Rule)
- **Dedicated Branch per Spec/Task:** Every SDD specification (`docs/sdd/NNNN-*.md`), feature increment, or fix **must** be developed in its own dedicated branch. Never implement a new spec on `main` or reuse an unrelated/previous spec's branch.
- **Verify Before Editing:** Before creating or modifying any files for a spec, inspect `git branch --show-current` and switch to a new branch (branched from `main`, or from an unmerged prerequisite feature branch when stacking increments).
- Keep `main` always buildable (`npm run build`) and lint-clean (`npm run lint`).
- Create descriptive branches per task or SDD spec:
  - `feat/<feature-slug>` (or `feat/sdd-NNNN-<slug>`)
  - `fix/<bug-slug>`
  - `refactor/<scope-slug>`
  - `docs/<topic-slug>`

## 3. Pull Request & Contribution Standard
- Follow [`CONTRIBUTING.md`](../../CONTRIBUTING.md) for local setup, branching, Conventional Commits, and review readiness.
- Use [`.github/pull_request_template.md`](../../.github/pull_request_template.md) for every Pull Request, with a Conventional Commit formatted PR title.

## 4. Pre-Commit / Definition of Done Checklist
Before considering any task complete:
1. Run `npm run typecheck` -> 0 errors.
2. Run `npm run lint` -> 0 errors, 0 warnings.
3. Run `npm run build` -> clean typecheck + production bundle.
3. Update `docs/` inventories (`features.md`, `components.md`, `hooks.md`, `store.md`, `services.md`, `utils.md`) for any added or modified code.
4. Add or update an incremental ADR in `docs/adr/` if an architectural decision was made.
5. Update the corresponding SDD spec status in `docs/sdd/` when completing a specified feature.
6. Update `AGENTS.md` if the tech stack, scripts, phase status, or repository structure changed.
