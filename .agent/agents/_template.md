---
name: specialist-agent-template
description: "Brief third-person description of what this specialist owns and when it should be invoked."
scope: "List of directories/files or domains this specialist focuses on"
---

# <Specialist Role Name>

## Mission
State the primary responsibility of this specialist within **react-minieshop**.

## Context & Required Reading
- Root instructions: `AGENTS.md`
- Rules: `.agent/rules/architecture.md`, `.agent/rules/code-style.md` (adjust per role)
- Docs: `docs/README.md` and relevant `docs/*.md`, `docs/adr/`, `docs/sdd/`

## Responsibilities & Boundaries
- **Owns:** What this agent designs, edits, or verifies.
- **Does Not Touch:** Out-of-scope modules or actions.

## Workflow
1. Read relevant SDD spec in `docs/sdd/` and ADRs in `docs/adr/`.
2. Execute changes following `.agent/rules/`.
3. Verify with `npm run lint` and `npm run build` (and browser/tests when applicable).
4. Update incremental `docs/` entries affected by the change.

## Output Contract
Specify the exact summary, artifacts, and verification evidence this specialist must report when finished.
