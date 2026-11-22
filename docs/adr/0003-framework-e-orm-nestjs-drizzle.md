# ADR-0003: Framework Backend (NestJS + Fastify) e ORM (Drizzle)

- **Status:** Accepted
- **Date:** 2026-11-21
- **Phase:** Fase 1 — Fundação Backend (`T01`, ref. spec `ADR-002`)

## Contexto
Precisamos selecionar o framework HTTP/DI e a camada de acesso a dados/migrations para `apps/api` em Node.js + TypeScript estrito, com suporte nativo a arquitetura modular, validação via Zod, alta performance HTTP, controle fino de SQL/PostgreSQL (schemas por módulo, `JSONB`, índices GIN, `tsvector` com `unaccent` e extensão `pgvector`) e custo zero.

## Decisão
- **Framework Backend:** **NestJS** com adaptador **Fastify** (`@nestjs/platform-fastify`).
  - O sistema de módulos (`@Module`) e injeção de dependência do NestJS alinha-se diretamente ao monolito modular.
  - O adaptador Fastify oferece menor overhead HTTP, melhor throughput e integração nativa com `pino` para logs estruturados e `requestId`.
- **ORM e Migrations:** **Drizzle ORM** (`drizzle-orm` + `drizzle-kit` + driver `pg`).
  - Schema definido em TypeScript com suporte direto a `pgSchema()` (um schema por módulo), índices customizados (`GIN`, `tsvector`), constraints `CHECK` e SQL explícito quando necessário.
  - Migrations SQL versionadas e inspecionáveis geradas/aplicadas via `drizzle-kit` e executadas pelo serviço `migrate`.
- **Validação:** **Zod** para validação de variáveis de ambiente no boot (fail-fast) e contratos compartilhados em `packages/contracts`.

## Alternativas Consideradas
- **Fastify puro (sem NestJS):** mais leve, porém exige montar manualmente convenções de DI, módulos, ciclo de vida (`OnModuleDestroy` para encerramento gracioso), guards e estrutura de projeto.
- **Express (como adaptador do NestJS ou puro):** mais lento que Fastify e sem suporte nativo a serialização rápida/logs estruturados com `pino`.
- **Prisma ORM:** excelente DX em casos simples, mas historicamente mais rígido com recursos avançados do PostgreSQL (`pgvector`, índices `tsvector` + `unaccent`, `pgSchema` multi-schema), gera runtime engine pesado e esconde o SQL gerado.
- **TypeORM:** API baseada em decorators com tipagem inferida mais frágil, histórico de bugs em migrations automáticas e menor previsibilidade de queries complexas.
- **Kysely:** ótimo query builder tipado, mas sem ecossistema integrado de declaração de schema + geração de migrations como o `drizzle-kit`.

## Consequências
### Positivas
- Tipagem ponta a ponta entre banco, serviços e contratos Zod sem geração de código binário pesado.
- Controle total sobre recursos avançados do PostgreSQL (`pgvector`, `unaccent`, `tsvector`, `JSONB`, schemas isolados).
- Estrutura modular padronizada pelo NestJS + performance do Fastify.

### Negativas / Trade-offs
- NestJS adiciona boilerplate de módulos/providers e requer atenção ao uso de `reflect-metadata` e decorators em TypeScript estrito.
- Recursos muito específicos do PostgreSQL (ex.: extensões `vector`/`unaccent` e colunas/índices `tsvector`) exigem migrations SQL customizadas ou `sql` raw no Drizzle.
