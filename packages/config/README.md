# `@minieshop/config`

Configurações compartilhadas de TypeScript (`tsconfig.base.json`), ESLint (`eslint.base.mjs`) e Prettier (`prettier.json`) para os pacotes do backend (`apps/api` e `packages/contracts`).

> **Nota de Monorepo:** durante a Fase 1, cada pacote mantém `package.json` e `pnpm-lock.yaml` próprios e referencia os demais via `link:`. A unificação em um workspace `pnpm` na raiz acontecerá na **T20**.
