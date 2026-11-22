import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import { createBaseConfig } from '@minieshop/config/eslint.base.mjs';

export default createBaseConfig({
  js,
  tseslint,
  extraConfigs: [
    {
      plugins: {
        boundaries,
      },
      settings: {
        'import/resolver': {
          typescript: {
            alwaysTryTypes: true,
            project: './tsconfig.json',
          },
        },
        'boundaries/include': ['src/**/*.ts'],
        'boundaries/elements': [
          {
            type: 'module-public',
            pattern: 'src/modules/*/index.ts',
            mode: 'full',
            capture: ['module'],
          },
          {
            type: 'module-internal',
            pattern: 'src/modules/*/**',
            mode: 'full',
            capture: ['module'],
          },
          {
            type: 'app-shell',
            pattern:
              'src/{app.module.ts,app.factory.ts,main.ts,index.ts,common/**,config/**,database/**,health/**,cli/**,seed/**,test/**}',
            mode: 'full',
          },
        ],
      },
      rules: {
        'boundaries/element-types': [
          'error',
          {
            default: 'disallow',
            rules: [
              {
                from: ['app-shell'],
                allow: ['app-shell', 'module-public'],
              },
              {
                from: ['module-public'],
                allow: [
                  'app-shell',
                  ['module-internal', { module: '${from.module}' }],
                  ['module-public', { module: '!${from.module}' }],
                ],
              },
              {
                from: ['module-internal'],
                allow: [
                  'app-shell',
                  ['module-internal', { module: '${from.module}' }],
                  ['module-public', { module: '!${from.module}' }],
                ],
              },
            ],
          },
        ],
      },
    },
  ],
});
