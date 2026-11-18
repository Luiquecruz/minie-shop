---
trigger: glob
globs: "src/**/*.js, src/**/*.jsx, src/**/*.css, *.js, *.json"
description: "Code style, React/JSX conventions, CSS design tokens, dark mode, accessibility, and Oxlint standards."
---

# Code Style & UI Conventions

## 1. Language & Module Format
- **JavaScript / JSX Only (until Phase 7):** Do not introduce `.ts` or `.tsx` files unless executing the Phase 7 TypeScript migration.
- **ES Modules:** Root `package.json` uses `"type": "module"`. Always use `import`/`export` syntax and include explicit `.js` or `.jsx` file extensions in relative imports (e.g., `import PriceBox from '../PriceBox/PriceBox.jsx'`).
- **English Only:** All identifiers, JSDoc blocks, inline comments, and UI strings must be written in English.

## 2. React & Component Structure
- Place each component or page in its own folder: `ComponentName/ComponentName.jsx` and `ComponentName/ComponentName.css`.
- Export components using both a named export and a default export (`export function ComponentName(...)` and `export default ComponentName;`) to keep imports flexible and satisfy `react/only-export-components`.
- Follow React Rules of Hooks strictly (`react/rules-of-hooks` is set to `error` in `.oxlintrc.json`).
- Add concise JSDoc comments on exported hooks, utilities, service methods, and reusable component props. Explain the *why* in inline comments, not obvious *what*.

## 3. CSS, Design Tokens & Dark Mode
- Use BEM-style class naming scoped to the component/page prefix (e.g., `.mini-cart__item-title`, `.product-card__btn--disabled`, `.plp-category-chip--active`).
- Always consume CSS custom properties defined in `src/index.css` (`--primary`, `--text`, `--text-heading`, `--text-muted`, `--bg`, `--card-bg`, `--border-color`, `--input-bg`, `--shadow-md`, `--container-max-width`, etc.) rather than hardcoding raw colors.
- Verify both Light Mode and Dark Mode (`@media (prefers-color-scheme: dark)` and `[data-theme="dark"]` / `html.dark`) and responsive breakpoints (`desktop`, `tablet`, `mobile`).

## 4. UI & Accessibility Standards
- **Zero Emojis in UI:** Never place Unicode emojis in JSX, labels, badges, empty states, or notifications. Use inline vector `<svg>` icons (`aria-hidden="true"` when decorative) or typography.
- **Semantic HTML & ARIA:** Use semantic landmarks (`<header>`, `<main>`, `<nav>`, `<footer>`, `<article>`), native `<button type="button">` for actions, and appropriate ARIA roles/attributes (`role="dialog"`, `aria-modal="true"`, `role="combobox"`, `role="listbox"`, `role="tablist"`, `role="alert"`, `aria-label`, `aria-expanded`).

## 5. Linting Compliance
- All edits must pass `npm run lint` (`oxlint` with `react` and `oxc` plugins configured in `.oxlintrc.json`) with **0 warnings and 0 errors**.
