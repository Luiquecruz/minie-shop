# ADR-0005: CSS Custom Properties Design System, Dark Mode, and SVG-Only UI

- **Status:** Accepted
- **Date:** 2026-10-27
- **Phase:** Phase 3–5

## Context
The application needs consistent visual identity, light/dark theme adaptation, responsive layouts, and cross-OS consistency for controls (such as `<select>` dropdowns) without adding heavy CSS frameworks or icon font libraries.

## Decision
- Define all design tokens (colors, surfaces, borders, shadows, typography, container width `1280px`) as CSS custom properties in **`src/index.css`**, supporting both `@media (prefers-color-scheme: dark)` and explicit `[data-theme="dark"]` / `html.dark` overrides.
- Colocate component-scoped BEM stylesheets (`ComponentName.css`) alongside JSX files.
- Build custom accessible primitives (`Dropdown.jsx`) rather than relying on inconsistent native OS `<select>` rendering.
- Enforce an **SVG-only UI icon policy**: Unicode emojis are strictly prohibited anywhere in the UI; use inline vector `<svg>` icons instead.

## Alternatives Considered
- **Tailwind CSS / UI Component Library (MUI, Chakra):** Rejected to maintain full control over CSS tokens, BEM architecture, and zero extra runtime/build overhead.
- **Icon font / large icon pack:** Rejected in favor of lightweight inline SVGs.

## Consequences
### Positive
- Zero CSS/UI runtime dependencies and crisp dark-mode contrast across every component.
- Accessible ARIA semantics (`combobox`, `listbox`, `dialog`, `tablist`) built directly into components.

### Negative / Trade-offs
- Requires manual visual verification of CSS token usage and dark-mode contrast for new components.

## Incremental Evolution Notes
If formal design token JSON generation or Tailwind is ever adopted, record a superseding ADR.
