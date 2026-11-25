---
trigger: always_on
description: "Formatting, empty-brace spacing, trailing whitespace, and EditorConfig/Prettier parity across the entire monorepo."
---

# Formatting & Spacing Rule

## 1. Empty Braces & Whitespace Standard
- **Never insert spaces inside empty braces:** Always write `{}` (e.g., `() => {}`, `.catch(() => {})`, `mockImplementation(() => {})`), **never** `{ }` or `() => { }`.
- **Single-source formatting:** Follow [`.editorconfig`](../../.editorconfig) (`indent_style = space`, `indent_size = 2`, `end_of_line = lf`, `insert_final_newline = true`, `trim_trailing_whitespace = true`, keeping `[*.md]` whitespace intact) and [`packages/config/prettier.json`](../../packages/config/prettier.json) (`semi: true`, `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`, `tabWidth: 2`) across all `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.css`, and `.json` files in `apps/` and `packages/`.

## 2. Editor / Disk Consistency (Preventing Save Conflicts)
- Keep Antigravity IDE / VS Code built-in JS/TS formatters aligned with Prettier by disabling `javascript.format.insertSpaceAfterOpeningAndBeforeClosingEmptyBraces`, `typescript.format.insertSpaceAfterOpeningAndBeforeClosingEmptyBraces`, `editor.formatOnSave`, and `editor.formatOnType` in user/workspace settings so open editor tabs never inject `{ }` spacing drift that triggers `Error: File Modified Since` against disk edits.
- Never introduce unrelated whitespace-only churn on untouched lines when editing existing files; run Prettier check (`packages/contracts` or `apps/api`) or `git diff --check` before committing.
