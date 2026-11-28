export { cn, type ClassValue } from '../utils/cn.js';

/**
 * Supported user-selectable theme preferences for `html[data-theme]` activation.
 */
export const THEME_MODES = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/**
 * Resolved color schemes applied to `html[data-theme]`.
 */
export const RESOLVED_THEMES = ['light', 'dark'] as const;
export type ResolvedTheme = (typeof RESOLVED_THEMES)[number];

/**
 * Semantic status tones exposed across `@minieshop/ui` feedback primitives.
 */
export const STATUS_TONES = ['info', 'success', 'warning', 'danger'] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

/**
 * Maximum content container width in pixels (`--container-max-width` / `max-w-storefront`).
 */
export const CONTAINER_MAX_WIDTH_PX = 1280 as const;

/**
 * Semantic CSS custom property inventory backed by CSS `light-dark()` in `@minieshop/ui/tokens.css`.
 */
export const SEMANTIC_COLOR_TOKENS = {
  brand: {
    default: '--brand',
    hover: '--brand-hover',
    light: '--brand-light',
    subtle: '--brand-subtle',
    subtleHover: '--brand-subtle-hover',
    border: '--brand-border',
  },
  surface: {
    page: '--surface-page',
    secondary: '--surface-secondary',
    tertiary: '--surface-tertiary',
    card: '--surface-card',
    cardSubtle: '--surface-card-subtle',
    input: '--surface-input',
    chip: '--surface-chip',
    chipHover: '--surface-chip-hover',
    nav: '--surface-nav',
  },
  border: {
    default: '--border-default',
    subtle: '--border-subtle',
  },
  foreground: {
    body: '--fg-body',
    heading: '--fg-heading',
    muted: '--fg-muted',
  },
  status: {
    success: '--status-success',
    successBg: '--status-success-bg',
    successBorder: '--status-success-border',
    warning: '--status-warning',
    warningBg: '--status-warning-bg',
    warningBorder: '--status-warning-border',
    danger: '--status-danger',
    dangerBg: '--status-danger-bg',
    dangerBorder: '--status-danger-border',
    info: '--status-info',
    infoBg: '--status-info-bg',
    infoBorder: '--status-info-border',
  },
  skeleton: {
    base: '--skeleton-base',
    highlight: '--skeleton-highlight',
  },
} as const;

/**
 * Semantic elevation shadow custom properties defined in `@minieshop/ui/tokens.css`.
 */
export const ELEVATION_TOKENS = {
  cardSm: '--shadow-card-sm',
  cardMd: '--shadow-card-md',
  cardLg: '--shadow-card-lg',
  floatingBar: '--shadow-floating-bar',
} as const;

/**
 * Z-index layering scale custom properties defined in `@minieshop/ui/tokens.css`.
 */
export const Z_INDEX_TOKENS = {
  stickyNav: '--z-sticky-nav',
  dropdown: '--z-dropdown',
  floatingBar: '--z-floating-bar',
  toast: '--z-toast',
  fab: '--z-fab',
  drawer: '--z-drawer',
  skipLink: '--z-skip-link',
} as const;
