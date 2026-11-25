---
trigger: glob
globs: "apps/**/*.ts, apps/**/*.tsx, apps/**/*.js, apps/**/*.mjs, apps/**/*.css, packages/**/*.ts, *.json"
description: "Code style, formatting/spacing, TypeScript/TSX conventions, CSS design tokens, dark mode, accessibility, and Oxlint standards."
---

# Code Style & UI Conventions

## 1. Language & Module Format
- **Strict TypeScript Only:** Author all application and Vite config modules in strict `.ts` / `.tsx` (`"strict": true`, `"allowJs": false` in `tsconfig.json`). Do not introduce `.js`/`.jsx` files under `src/`.
- **Zero-`any` Policy:** Never use explicit `any` (`typescript/no-explicit-any: "error"` in `.oxlintrc.json`) or implicit `any`. Narrow `unknown` values (e.g., `JSON.parse` from `localStorage` or `catch (err: unknown)`) with explicit runtime type guards (`instanceof Error`, `instanceof DOMException`, property checks).
- **ES Modules & Extensionless Imports:** Root `package.json` uses `"type": "module"` and `tsconfig.json` uses `"moduleResolution": "bundler"`. Always use `import`/`export` syntax and extensionless relative imports for `.ts`/`.tsx` modules (e.g., `import PriceBox from '../PriceBox/PriceBox'`). Keep `.css` extensions for stylesheet imports.
- **English Only:** All identifiers, TypeScript interfaces/types, JSDoc blocks, inline comments, and UI strings must be written in English.

## 2. React & Component Structure
- Place each component or page in its own folder: `ComponentName/ComponentName.tsx` and `ComponentName/ComponentName.css`.
- Co-locate exported prop interfaces (e.g., `PriceBoxProps`, `DropdownProps<T>`) inside the component's `.tsx` file, while keeping shared domain models under `src/types/`.
- Export components using both a named export and a default export (`export function ComponentName(...)` and `export default ComponentName;`) to keep imports flexible and satisfy `react/only-export-components`.
- Follow React Rules of Hooks strictly (`react/rules-of-hooks` is set to `error` in `.oxlintrc.json`).
- Add concise JSDoc comments on exported hooks, utilities, service methods, and reusable components. Explain the *why* in inline comments, not obvious *what*.

## 3. CSS, Design Tokens & Dark Mode
- Use BEM-style class naming scoped to the component/page prefix (e.g., `.mini-cart__item-title`, `.product-card__btn--disabled`, `.plp-category-chip--active`).
- Always consume CSS custom properties defined in `src/index.css` (`--primary`, `--text`, `--text-heading`, `--text-muted`, `--bg`, `--card-bg`, `--border-color`, `--input-bg`, `--shadow-md`, `--container-max-width`, etc.) rather than hardcoding raw colors.
- Verify both Light Mode and Dark Mode (`@media (prefers-color-scheme: dark)` and `[data-theme="dark"]` / `html.dark`) and responsive breakpoints (`desktop`, `tablet`, `mobile`).

## 4. UI & Accessibility Standards
- **Zero Emojis in UI:** Never place Unicode emojis in JSX/TSX, labels, badges, empty states, or notifications. Use inline vector `<svg>` icons (`aria-hidden="true"` when decorative) or typography.
- **Semantic HTML & ARIA:** Use semantic landmarks (`<header>`, `<main>`, `<nav>`, `<footer>`, `<article>`), native `<button type="button">` for actions, and appropriate ARIA roles/attributes (`role="dialog"`, `aria-modal="true"`, `role="combobox"`, `role="listbox"`, `role="tablist"`, `role="alert"`, `aria-label`, `aria-expanded`).

## 5. Linting, Formatting & Typecheck Compliance
- **Formatting & Empty Braces:** Follow `.editorconfig` (2-space indent, LF, trailing whitespace trimmed, final newline) and `packages/config/prettier.json`; write `{}` without internal spaces (`() => {}`, never `() => { }`).
- All edits must pass `pnpm typecheck` (`tsc --noEmit`) with **0 errors** and `pnpm lint` (`eslint` / `oxlint`) with **0 warnings and 0 errors**.
