# ADR-0016: Monorepo com pnpm Workspaces e Turborepo

- **Status:** Accepted
- **Date:** 2026-11-23
- **Phase:** Fase 6 — Monorepo e Integração Storefront (`T20`)

## Contexto

Até a Fase 5, o SPA React vivia na raiz do repositório (gerenciado por `npm` com `package-lock.json`), enquanto o backend (`apps/api`, `packages/contracts`, `packages/config` e `packages/email`) operava em pacotes isolados com `pnpm-lock.yaml` próprios e dependências via `link:`. Com a chegada da Fase 6, o storefront passa a consumir diretamente os contratos Zod em `@minieshop/contracts`, compartilhar configurações base em `@minieshop/config` e ser orquestrado junto com a API em CI e Docker.

Precisamos de uma estrutura de monorepo que:
- garanta um único lockfile determinístico e zero custo operacional;
- compartilhe contratos de API e tipos de forma atômica no mesmo commit/PR;
- execute `build`, `lint`, `typecheck` e `test` respeitando o grafo de dependências entre pacotes com cache local e em CI;
- permita builds Docker enxutos com cache de camadas eficiente usando contexto na raiz.

## Decisão

1. **Workspace `pnpm` (`pnpm-workspace.yaml`):**
   - Estrutura canônica `apps/*` (`apps/api`, `apps/storefront`) e `packages/*` (`packages/contracts`, `packages/config`, `packages/email`).
   - Dependências internas declaradas exclusivamente com o protocolo `workspace:*` (substituindo todos os `link:`).
   - Lockfile único `pnpm-lock.yaml` na raiz; remoção de todos os lockfiles individuais (`package-lock.json` do SPA e `pnpm-lock.yaml` por pacote do backend).
   - `packageManager` fixado em `"pnpm@12.21.0"` e `.nvmrc` fixado em Node `26`.
   - `allowBuilds` centralizado em `pnpm-workspace.yaml` para módulos nativos estritamente necessários (`argon2`, `esbuild`, `sharp`).
2. **Orquestração com Turborepo (`turbo@2.11.13`):**
   - `turbo.json` (schema v2 com `tasks`) definindo o grafo topológico (`^build`) para `build`, `typecheck`, `lint`, `test` e `dev` (`persistent: true`, `cache: false`), além de `env: ["VITE_*"]` no `build`.
   - Scripts na raiz delegados ao Turbo: `build`, `lint`, `typecheck`, `test`, `dev:storefront` e `dev:api`.
   - Dockerfiles com contexto na raiz usando `turbo prune <pacote> --docker`, preservando o cache de instalação de dependências quando apenas o código-fonte muda.
3. **Política de versões e configurações compartilhadas:**
   - Ferramentas de orquestração e contratos críticos fixados em versões exatas (`pnpm@12.21.0`, `turbo@2.11.13`, `zod@3.24.2` alinhado entre `@minieshop/contracts`, `@minieshop/api` e `@minieshop/storefront`).
   - `apps/storefront/tsconfig.json` estende `@minieshop/config/tsconfig.base.json` mantendo apenas overrides exigidos pelo bundler Vite/DOM (`module: "ESNext"`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`, `noEmit: true`) e `noUncheckedIndexedAccess: false` para não quebrar código congelado das etapas 1–4.
   - `apps/storefront` mantém **Oxlint** (`.oxlintrc.json`) em vez de migrar para ESLint para preservar exatamente o comportamento, regras React/TS e velocidade já validados no SPA.
4. **Preservação de histórico Git:**
   - O SPA foi movido para `apps/storefront` em um commit puro de `git mv` sem alterações de conteúdo, preservando `git log --follow` completo.

## Alternativas Consideradas

- **Nx:** descartado para o porte atual do projeto por adicionar superfície de configuração, plugins, daemon e geradores mais pesados do que o necessário; Turborepo entrega grafo topológico, cache e `turbo prune --docker` com um único `turbo.json` mínimo.
- **Repositórios separados (polyrepo):** descartado porque quebraria a evolução atômica entre `@minieshop/contracts`, `@minieshop/api` e `@minieshop/storefront`, exigindo publicação/versionamento de pacotes internos a cada alteração de contrato e dificultando o stack único em Docker Compose.
- **Manter `npm` na raiz com workspaces:** descartado pois o backend já padronizou `pnpm@12.21.0` com store content-addressable, `allowBuilds` explícito e isolamento estrito de dependências (sem phantom dependencies).

## Consequências

### Positivas
- Instalação única (`pnpm install`), lockfile único e cache compartilhado entre pacotes em local e CI.
- Mudanças em `packages/contracts` são imediatamente visíveis e tipadas no storefront e na API no mesmo PR.
- Builds Docker da API/Worker e do Storefront usam contexto na raiz com `turbo prune --docker`, mantendo camadas enxutas e rápidas.

### Negativas / Trade-offs
- Exige atenção ao alinhamento de versões de bibliotecas compartilhadas (ex.: `zod` v3 entre contratos e apps).
- Coexistem dois linters no monorepo (ESLint com `eslint-plugin-boundaries` no backend e Oxlint no storefront), o que é aceitável porque ambos são executados de forma uniforme por `pnpm lint`.
