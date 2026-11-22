import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['catalog', 'media', 'recommendations', 'inventory', 'identity', 'platform'],
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://minieshop:minieshop_dev_password@localhost:5432/minieshop',
  },
});
