# Project Specialist Agents

This directory holds definitions for project-specific specialist agents as the Minie Shop architecture grows.

## Planned Specialist Roles
As phases progress (Phase 6 Checkout, Phase 7 TypeScript migration, Automated Testing), specialist agents can be added here as Markdown files:

| Agent File | Role | Focus Area |
| :--- | :--- | :--- |
| `_template.md` | Template | Standard blueprint for authoring new specialist agents |
| `architect.md` *(planned)* | Frontend Architect | SDD authoring, ADR maintenance, module boundaries |
| `ui-engineer.md` *(planned)* | UI & Accessibility Specialist | Design tokens, dark mode, responsive layout, ARIA/SVG compliance |
| `ts-migrator.md` *(planned)* | TypeScript Migration Specialist | Incremental `.js`/`.jsx` to `.ts`/`.tsx` typing in Phase 7 |
| `qa-reviewer.md` *(planned)* | QA & Test Engineer | Unit/integration tests, Oxlint checks, browser flow verification |

## Authoring Convention
1. Copy [`_template.md`](./_template.md) to `<agent-slug>.md`.
2. Define clear `name`, `description`, `scope`, `rules_to_load`, and `output_contract`.
3. Reference domain rules in `../rules/` (`architecture.md`, `code-style.md`, `testing.md`, `git-workflow.md`) rather than duplicating them.
4. Register any architectural conventions introduced by a new agent workflow in `docs/adr/` if applicable.
