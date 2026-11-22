/**
 * Shared ESLint flat config base for backend packages.
 * Accepts consumer-resolved `js` (@eslint/js) and `tseslint` (typescript-eslint)
 * so packages linked via `link:` work without duplicating node_modules in packages/config.
 */
export function createBaseConfig({ js, tseslint, extraConfigs = [] }) {
  return tseslint.config(
    {
      ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'drizzle/**'],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
      },
    },
    ...extraConfigs,
  );
}
