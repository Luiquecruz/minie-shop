# ADR-0002: Monolito Modular em Monorepo e Gatilhos de Extração

- **Status:** Partially Superseded by [ADR-0016](./0016-monorepo-pnpm-workspaces-turborepo.md) and [ADR-0023](./0023-monorepo-package-boundaries-stack-typescript-and-contracts.md) *(Phase 1 isolated `link:` setup superseded by unified pnpm workspaces + Turborepo, stack-pinned TypeScript, and per-schema ESLint DB boundaries)*
- **Date:** 2026-11-21
- **Phase:** Fase 1 — Fundação Backend (`T01`, ref. spec `ADR-001`)

## Contexto
O Progressive Minie Shop evolui de um SPA React frontend-only para uma plataforma completa de e-commerce "production ready" com catálogo, mídia, estoque, identidade, recomendações e plataforma. Precisamos de uma arquitetura de backend que entregue alta velocidade de desenvolvimento, simplicidade operacional em ambiente local (OrbStack/Docker Compose) e baixo acoplamento entre domínios, evitando o custo prematuro de sistemas distribuídos.

## Decisão
- Adotar um **monolito modular em monorepo**:
  - `apps/api/`: aplicação backend única (NestJS + Fastify), organizada em módulos de domínio coesos (`catalog`, `media`, e futuramente `inventory`, `identity`, `recommendations`, `platform`).
  - `packages/contracts/`: schemas Zod e tipos compartilhados.
  - `packages/config/`: configurações base de TypeScript, ESLint e Prettier.
  - `infra/`: infraestrutura local (Docker Compose, Makefile, `.env.example`).
- **Fronteiras estritas entre módulos:** cada módulo expõe exclusivamente um `index.ts` público; importações profundas (`../outro-modulo/...`) são bloqueadas por regra de lint (falhando o build).
- **Isolamento incremental do SPA:** durante a Fase 1, `apps/api`, `packages/contracts` e `packages/config` operam com `package.json` e `pnpm-lock.yaml` próprios e dependências via `link:`, sem tocar no SPA nem na raiz; a unificação em workspace `pnpm` ocorre posteriormente (T20).
- **Gatilhos objetivos para extrair um módulo para serviço independente** (fora de escopo agora):
  1. **Escala assimétrica comprovada:** um módulo (ex.: processamento pesado de mídia ou recomendações/embeddings) exige perfis de CPU/RAM/GPU incompatíveis com o restante da API, mesmo após otimização vertical e filas assíncronas.
  2. **Isolamento de falhas ou compliance:** necessidade regulatória (ex.: PCI-DSS para pagamentos) ou SLA/ciclo de deploy estritamente independente.
  3. **Escala organizacional:** múltiplos times independentes colidindo em deploy e ownership do mesmo artefato.

## Alternativas Consideradas
- **Micro-serviços desde o dia 1:** descartado por multiplicar latência de rede, transações distribuídas, observabilidade, contratos versionados em rede e complexidade de Compose/CI sem demanda de escala ou de times.
- **Monolito sem fronteiras (camadas técnicas globais `controllers/`, `services/`, `repositories/`):** descartado porque favorece acoplamento cruzado entre domínios e dificulta qualquer extração ou refatoração futura.
- **Repositórios separados (polyrepo):** descartado por dificultar compartilhamento atômico de contratos Zod, configurações de lint/TS e evolução sincronizada entre API e SPA.

## Consequências
### Positivas
- Deploy único, transações ACID locais no PostgreSQL, refatoração assistida por TypeScript e onboarding rápido.
- Fronteiras verificadas automaticamente por lint garantem baixo acoplamento desde o início.
- Caminho de extração futuro preservado caso algum gatilho objetivo seja atingido.

### Negativas / Trade-offs
- Exige disciplina na definição das portas públicas (`index.ts`) e manutenção das regras de fronteira no lint.
- Todos os módulos compartilham o mesmo processo Node.js e ciclo de deploy enquanto estiverem no monolito.
