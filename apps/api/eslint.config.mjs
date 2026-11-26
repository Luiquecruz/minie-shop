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
            type: 'db-schema-index',
            pattern: 'src/database/schema/index.ts',
            mode: 'full',
          },
          {
            type: 'db-schema',
            pattern: 'src/database/schema/*.ts',
            mode: 'full',
            capture: ['schema'],
          },
          {
            type: 'app-shell',
            pattern:
              'src/{app.module.ts,app.factory.ts,main.ts,index.ts,common/**,config/**,database/database.module.ts,database/database.service.ts,database/migrate.ts,health/**,cli/**,seed/**,test/**,worker/**}',
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
                allow: ['app-shell', 'module-public', 'db-schema-index', 'db-schema'],
              },
              {
                from: ['db-schema-index'],
                allow: ['db-schema'],
              },
              {
                from: ['db-schema'],
                allow: ['db-schema'],
              },
              {
                from: ['module-public'],
                allow: [
                  'app-shell',
                  ['db-schema', { schema: '${from.module}' }],
                  ['module-internal', { module: '${from.module}' }],
                  ['module-public', { module: '!${from.module}' }],
                ],
              },
              {
                from: ['module-internal'],
                allow: [
                  'app-shell',
                  ['db-schema', { schema: '${from.module}' }],
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
