---
trigger: glob
globs: "apps/**/*.ts, apps/**/*.tsx, apps/**/*.js, apps/**/*.mjs, apps/**/*.css, packages/**/*.ts, *.json"
description: "Code style, formatting/spacing, TypeScript/TSX conventions, Tailwind CSS v4 tokens, dark mode, accessibility, and lint standards."
---

# Code Style & UI Conventions

## 1. Language & Module Format
- **Strict TypeScript Only:** Author all application, package, and Vite config modules in strict `.ts` / `.tsx` (`"strict": true`, `"allowJs": false`, stack-pinned `5.9.3` for Node packages and `7.0.2` for storefront). Do not introduce `.js`/`.jsx` files under `src/`.
- **Zero-`any` Policy:** Never use explicit `any` (`typescript/no-explicit-any: "error"` in Oxlint and `@typescript-eslint/no-explicit-any` in ESLint) or implicit `any`. Narrow `unknown` values (e.g., `JSON.parse` from `localStorage` or `catch (err: unknown)`) with explicit runtime type guards (`instanceof Error`, `instanceof DOMException`, Zod schemas, or property checks).
- **ES Modules & Import Conventions:** All workspace packages use `"type": "module"`. Storefront uses extensionless bundler imports (`moduleResolution: "bundler"`); NodeNext packages (`apps/api`, `packages/contracts`, `packages/email`) follow NodeNext `.js` relative import rules where required by `tsconfig.node.json`.
- **English Only:** All identifiers, TypeScript interfaces/types, JSDoc blocks, inline comments, and default UI copy must be written in English (Portuguese user-facing copy lives strictly inside `apps/storefront/src/i18n/pt-BR.ts`).

## 2. React & Component Structure
- Place each storefront component or page in its own `PascalCase/` folder (`ComponentName/ComponentName.tsx`) without colocated `.css` files (styled with Tailwind CSS v4 utilities + `cn()`).
- Co-locate exported prop interfaces (e.g., `PriceBoxProps`, `DropdownProps<T>`) inside the component's `.tsx` file; keep shared API DTOs in `@minieshop/contracts` and storefront-specific domain types under `apps/storefront/src/types/`.
- Export components with both named and default exports (`export function ComponentName(...)` and `export default ComponentName;`) where appropriate to satisfy `react/only-export-components`.
- Follow React Rules of Hooks strictly (`react/rules-of-hooks: "error"`).
- Add concise JSDoc comments on exported hooks, utilities, repository methods, and reusable components. Explain the *why* in inline comments, not the obvious *what*.

## 3. Tailwind CSS v4, Semantic Tokens & Dark Mode (`ADR-0024`)
- Style storefront UI exclusively using Tailwind CSS v4 utilities composed with `cn()` (`apps/storefront/src/utils/cn.ts`) and semantic color/elevation/typography tokens exposed via `@theme inline` in `apps/storefront/src/index.css` (`bg-surface`, `bg-surface-subtle`, `bg-bg`, `text-fg`, `text-fg-heading`, `text-fg-muted`, `border-border`, `bg-brand`, `text-success`, `text-warning`, `text-danger`, `shadow-card-sm`, etc.).
- Never hardcode raw hex/rgb surface or text colors in components; define or extend semantic `light-dark()` tokens in `apps/storefront/src/index.css`.
- Use Tailwind's built-in `sr-only` for screen-reader-only content (do not create custom `visually-hidden` classes).
- Verify Light Mode, Dark Mode, and System preference (`html[data-theme="light" | "dark"]`) plus responsive desktop (`1440px`), tablet (`768px`), and mobile (`390px`) layouts with zero horizontal overflow.

## 4. UI & Accessibility Standards (WCAG 2.1 AA)
- **Zero Emojis in UI:** Never place Unicode emojis in JSX/TSX, labels, badges, empty states, or notifications. Use inline vector `<svg>` icons (`aria-hidden="true"` when decorative) or semantic typography.
- **Semantic HTML, Landmarks & Keyboard APG:**
  - Keep a single `<main id="main-content">` in `RootLayout` with a keyboard-reachable Skip Link.
  - Use native interactive elements (`<button type="button">`, `<dialog>.showModal()`, `<a href>` / `<Link>`) and preserve visible `focus-visible` indicators on every focusable control.
  - Follow WAI-ARIA APG keyboard contracts for composite widgets (`SearchBar` combobox, `Dropdown` listbox, PDP `tablist`, `MiniCart` modal drawer with focus restoration).
  - Satisfy all enabled `jsx-a11y` Oxlint rules and `vitest-axe` zero-violation checks.

## 5. Linting, Formatting & Typecheck Compliance
- **Formatting & Empty Braces:** Follow `.editorconfig` (2-space indent, LF, trailing whitespace trimmed, final newline) and `packages/config/prettier.json`; write `{}` without internal spaces (`() => {}`, never `() => { }`).
- All edits must pass `pnpm typecheck` (`0` errors) and `pnpm lint` (`0` warnings and `0` errors across ESLint and Oxlint).
