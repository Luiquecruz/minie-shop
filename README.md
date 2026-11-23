# Progressive Minie Shop

Plataforma de e-commerce "production ready" construída incrementalmente em monorepo (`pnpm` workspaces + `Turborepo`) com **React 19 + Vite + TypeScript + TanStack Query + Redux Toolkit** no storefront e **NestJS + Fastify + Drizzle + PostgreSQL (pgvector) + SeaweedFS + Meilisearch + Outbox Worker** no backend.

---

## Quick Start (Docker / OrbStack)

Pré-requisitos: Docker (OrbStack ou Docker Desktop) com Docker Compose v2.

```bash
# 1. Copie as variáveis de ambiente de desenvolvimento (não comite .env)
cp .env.example .env

# 2. Suba todos os serviços (banco, storage, busca, migrations, api, worker, mailpit e storefront)
docker compose up -d --build

# 3. (Primeira vez) Popule o catálogo de exemplo (30 produtos, 21 categorias, imagens e recomendações)
docker compose --profile seed run --rm seed
```

Após os healthchecks ficarem verdes (`docker compose ps`):

- **Storefront (SPA):** http://localhost:5199
- **API HTTP:** http://localhost:3001/health e http://localhost:3001/products
- **SeaweedFS S3 (mídia pública):** http://localhost:8333
- **Meilisearch:** http://localhost:7700
- **Mailpit UI (e-mails locais):** http://localhost:8025

> **Stack com IA / Embeddings locais (profile `ai`):**
> ```bash
> docker compose --profile ai up -d --build
> ```
> Para resetar completamente o ambiente do zero (recriando volumes, migrations, seed e aguardando o outbox drenar):
> ```bash
> make -C infra reset
> ```

---

## Mapa do Monorepo

```text
react-minieshop/
├── apps/
│   ├── storefront/          # SPA React 19 + Vite 8 + React Router + React Query + Redux Toolkit
│   └── api/                 # Backend NestJS + Fastify + Drizzle + Worker de Outbox
├── packages/
│   ├── contracts/           # Schemas Zod compartilhados (.strict() na API / parse tolerante no cliente)
│   ├── config/              # Configurações base compartilhadas (tsconfig, eslint, prettier)
│   └── email/               # Templates de e-mail transacional (React Email)
├── infra/
│   ├── compose.yaml         # Definição completa dos serviços Docker e healthchecks
│   ├── Makefile             # Atalhos operacionais (up, reset, reset-ai, seed, logs, ps)
│   └── seaweedfs/           # Configuração S3 local do SeaweedFS
├── docs/
│   ├── architecture.md      # Diagramas de módulos, outbox e fluxo storefront -> API
│   ├── api.md               # Referência completa dos endpoints públicos e caos em dev
│   ├── adr/                 # Architecture Decision Records (ADR-0001..ADR-0017)
│   ├── metrics/             # Relatórios de métricas (busca, recomendações, integração frontend)
│   └── sdd/                 # Especificações orientadas a spec (SDD)
├── compose.yaml             # Wrapper na raiz (include de infra/compose.yaml)
├── .env.example             # Variáveis de ambiente padrão de desenvolvimento
├── pnpm-workspace.yaml      # Definição de workspaces pnpm e allowBuilds
└── turbo.json               # Pipeline e cache de tarefas do Turborepo
```

---

## Diagrama de Serviços e Portas (Docker Compose)

```mermaid
flowchart TB
  Browser["Navegador do Usuário"]

  subgraph StackPadrao["Stack Padrão (docker compose up)"]
    SF["storefront\nlocalhost:5199\n(Vite dev / Nginx prod)"]
    API["api\nlocalhost:3001\n(NestJS + Fastify)"]
    WRK["worker\nporta interna :3002\n(Outbox consumer)"]
    PG["postgres (pgvector:pg17)\nlocalhost:5432"]
    MIG["migrate (one-shot)\ndb:migrate"]
    S3["storage (SeaweedFS)\nS3 :8333 | Master :9333 | Filer :8888"]
    BKT["init-buckets (one-shot)\ncria buckets S3"]
    MS["search (Meilisearch)\nlocalhost:7700"]
    IMS["init-search (one-shot)\níndices + chaves"]
    MP["mailpit\nSMTP :1025 | UI :8025"]
  end

  subgraph ProfileSeed["Profile: seed"]
    SEED["seed (one-shot)\ncatálogo + mídia + admin"]
  end

  subgraph ProfileAI["Profile: ai (opcional)"]
    EMB["embeddings (Ollama)\nlocalhost:11434"]
    IEMB["init-embeddings (one-shot)\nollama pull embeddinggemma"]
  end

  Browser -->|"HTTP :5199"| SF
  Browser -->|"fetch + credentials: include :3001"| API
  Browser -->|"Imagens WebP :8333"| S3
  Browser -.->|"UI de e-mails :8025"| MP

  SF -.->|"depends_on: healthy"| API
  MIG --> PG
  BKT --> S3
  IMS --> MS
  SEED --> PG
  SEED --> S3
  API --> PG
  API --> S3
  API --> MS
  API --> MP
  WRK --> PG
  WRK --> MS
  WRK --> MP
  IEMB --> EMB
  API -.->|"profile ai"| EMB
  WRK -.->|"profile ai"| EMB
```

---

## Topologia de Origem, CORS e Cookies (`SameSite`)

- Em desenvolvimento local, o storefront roda em `http://localhost:5199` e a API em `http://localhost:3001`.
- Embora sejam **cross-origin** (portas diferentes exigem CORS explícito com `CORS_ORIGINS=http://localhost:5199` e `credentials: 'include'`), ambos compartilham o mesmo registrable domain (`localhost`), sendo classificados pelo navegador como **same-site**.
- Por serem **same-site**, cookies `HttpOnly; SameSite=Lax` (como `anon_id` para favoritos anônimos e `sid_customer` para sessões) são enviados e gravados normalmente nas requisições `fetch(..., { credentials: 'include' })`, e o cabeçalho `Origin` é enviado automaticamente em métodos que alteram estado (`POST`, `DELETE`, `PATCH`).
- **O que mudaria em produção com domínios distintos (cross-site):**
  - Se o storefront estiver em `https://loja.exemplo.com` e a API em `https://api.outro-dominio.com` (eTLD+1 diferentes), cookies `SameSite=Lax` **não** serão enviados em requisições XHR/fetch cross-site.
  - Soluções recomendadas em produção: (1) servir API e storefront sob o mesmo eTLD+1 (ex.: `https://loja.exemplo.com` e `https://api.loja.exemplo.com` — continuam same-site) ou atrás de um mesmo reverse proxy/BFF (`/api`), mantendo `SameSite=Lax; Secure; HttpOnly`; ou (2) caso precisem ser domínios totalmente distintos, usar `SameSite=None; Secure; HttpOnly` + validação rigorosa de `Origin` e CSRF (com a limitação de bloqueio de third-party cookies em navegadores restritivos).

---

## Comandos Úteis

### Desenvolvimento e Qualidade (Monorepo via pnpm + Turborepo)

```bash
pnpm install              # Instala todas as dependências do workspace (lockfile único)
pnpm build                # Build topológico de todos os pacotes (contracts -> apps)
pnpm lint                 # Lint em todos os pacotes (ESLint no backend, Oxlint no storefront)
pnpm typecheck            # Verificação estrita de tipos em todo o monorepo
pnpm test                 # Testes unitários/componente/Profiler de todos os pacotes
pnpm dev:storefront       # Sobe apenas o Vite do storefront fora do Docker (lê VITE_API_URL do .env raiz)
# Para subir apenas a API no host (fora do Docker), carregue as variáveis com endpoints em localhost:
set -a && source .env && set +a && DATABASE_URL=postgresql://minieshop:minieshop_dev_password@localhost:5432/minieshop S3_ENDPOINT=http://localhost:8333 MEILI_HOST=http://localhost:7700 pnpm dev:api
```

### Operação do Stack (Docker Compose / Makefile)

```bash
docker compose up -d --build     # Sobe o stack completo em background
docker compose watch             # Sobe com hot-reload (develop.watch) para API e Storefront
docker compose ps                # Verifica o status de saúde de todos os containers
docker compose logs -f api       # Acompanha logs da API (ou storefront / worker)
docker compose down              # Para e remove os containers mantendo volumes
make -C infra reset              # Recria tudo do zero (down -v + up + seed + outbox drain)
make -C infra reset-ai           # Recria tudo com profile ai (Ollama + embeddings)
```

### Build de Produção do Storefront (Nginx)

```bash
docker build -f apps/storefront/Dockerfile --target production \
  --build-arg VITE_API_URL=http://localhost:3001 \
  -t minieshop-storefront:prod .
```

---

## Troubleshooting

1. **Porta já em uso (`5199`, `3001`, `5432`, `7700`, `8333`):**
   Ajuste `STOREFRONT_PORT`, `POSTGRES_PORT`, `MEILI_PORT` ou `S3_PORT` no `.env` da raiz. Para trocar a porta publicada da API no host (ex.: `3005`), mantenha a porta interna fixa em `3001` no container/healthcheck (alterando apenas o mapeamento do host `${API_HOST_PORT:-3001}:3001` em `infra/compose.yaml`, ou ajustando também `PORT`, `ports` e `healthcheck` juntos) e atualize `VITE_API_URL` e `CORS_ORIGINS` no `.env`.
2. **Catálogo vazio ao abrir http://localhost:5199 pela primeira vez:**
   Execute `docker compose --profile seed run --rm seed` (ou `make -C infra reset`).
3. **Erro de CORS ou favoritos não persistindo:**
   Confirme que `CORS_ORIGINS` no `.env` inclui exatamente `http://localhost:5199` (sem barra no final) e que o storefront acessa a API por `http://localhost:3001` (mesmo hostname `localhost`, não misturando `127.0.0.1` com `localhost`).
4. **Simulando falhas/latência (Chaos Middleware em DEV):**
   Certifique-se de que `CHAOS_ENABLED=true` e `NODE_ENV=development` no `.env`. No navegador em modo DEV, defina `localStorage.setItem('chaos.delay', '800')` ou `localStorage.setItem('chaos.fail', '1')` (ou use o painel flutuante de Caos em DEV).
5. **Imagens indisponíveis / teste de fallback:**
   Para testar o fallback de mídia com storage fora do ar: `docker compose stop storage` e recarregue o storefront; depois reative com `docker compose start storage`.
