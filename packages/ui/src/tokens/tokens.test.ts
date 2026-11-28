import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CONTAINER_MAX_WIDTH_PX,
  ELEVATION_TOKENS,
  RESOLVED_THEMES,
  SEMANTIC_COLOR_TOKENS,
  STATUS_TONES,
  THEME_MODES,
  Z_INDEX_TOKENS,
  cn,
} from './index.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(resolve(currentDir, 'tokens.css'), 'utf8');
const stylesCss = readFileSync(resolve(currentDir, 'styles.css'), 'utf8');
const tokensIndexSource = readFileSync(resolve(currentDir, 'index.ts'), 'utf8');
const cnSource = readFileSync(resolve(currentDir, '../utils/cn.ts'), 'utf8');
const rootIndexSource = readFileSync(resolve(currentDir, '../index.ts'), 'utf8');

describe('cn()', () => {
  it('merges conditional classes and resolves Tailwind CSS conflicts', () => {
    const isHidden = false;
    expect(cn('px-2 py-1', isHidden && 'hidden', false, 'px-4')).toBe('py-1 px-4');
    expect(cn('bg-surface text-fg', undefined, null, 'bg-brand text-white')).toBe(
      'bg-brand text-white',
    );
    expect(cn('text-xs', 'text-brand')).toBe('text-xs text-brand');
  });

  it('supports object and array inputs via clsx', () => {
    expect(cn(['rounded-md', { 'opacity-50': true, 'pointer-events-none': false }])).toBe(
      'rounded-md opacity-50',
    );
  });
});

describe('@minieshop/ui/tokens metadata & CSS contract', () => {
  it('exports stable theme, status, layout, elevation, and z-index constants', () => {
    expect(THEME_MODES).toEqual(['system', 'light', 'dark']);
    expect(RESOLVED_THEMES).toEqual(['light', 'dark']);
    expect(STATUS_TONES).toEqual(['info', 'success', 'warning', 'danger']);
    expect(CONTAINER_MAX_WIDTH_PX).toBe(1280);
    expect(ELEVATION_TOKENS.cardSm).toBe('--shadow-card-sm');
    expect(Z_INDEX_TOKENS.skipLink).toBe('--z-skip-link');
  });

  it('defines every documented CSS custom property inside tokens.css', () => {
    const allVars = [
      ...Object.values(SEMANTIC_COLOR_TOKENS).flatMap((group) => Object.values(group)),
      ...Object.values(ELEVATION_TOKENS),
      ...Object.values(Z_INDEX_TOKENS),
    ];

    for (const cssVar of allVars) {
      expect(tokensCss).toContain(`${cssVar}:`);
    }
  });

  it('declares Baseline 2024+ theme activation, light-dark(), @theme inline, and reduced-motion utilities', () => {
    expect(tokensCss).toContain('color-scheme: light dark;');
    expect(tokensCss).toContain(':root[data-theme="light"]');
    expect(tokensCss).toContain(':root[data-theme="dark"]');
    expect(tokensCss).toContain('@custom-variant dark');
    expect(tokensCss).toContain('@theme inline');
    expect(tokensCss).toContain('light-dark(');
    expect(tokensCss).toContain('.skeleton-shimmer');
    expect(tokensCss).toContain('.scrollbar-none');
    expect(tokensCss).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('exposes the Tailwind v4 consumer preset with @import and @source in styles.css', () => {
    expect(stylesCss).toContain('@import "./tokens.css";');
    expect(stylesCss).toContain('@source "../";');
  });

  it('keeps the tokens subpath strictly React-free and the root barrel RSC-safe', () => {
    expect(tokensIndexSource).not.toMatch(/from\s+['"]react(?:-dom)?['"]/);
    expect(cnSource).not.toMatch(/from\s+['"]react(?:-dom)?['"]/);
    expect(tokensIndexSource).not.toContain('import.meta.env');
    expect(cnSource).not.toContain('import.meta.env');
    expect(rootIndexSource.trimStart().startsWith("'use client'")).toBe(false);
    expect(rootIndexSource.trimStart().startsWith('"use client"')).toBe(false);
  });
});
