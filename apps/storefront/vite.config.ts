import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Read monorepo root `.env` during `vite dev` for VITE_API_URL convenience,
  // but never load root `.env` during `vite build` (root `.env` sets NODE_ENV=development
  // for local Docker/API dev, which would inject DEV-only modules into production builds).
  ...(command === 'serve' ? { envDir: '../..' } : {}),
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5199,
    open: !process.env.CI && process.env.DOCKER !== 'true',
  },
}));
