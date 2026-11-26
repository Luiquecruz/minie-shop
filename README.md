# Progressive Minie Shop

An incremental, production-oriented e-commerce platform built in a **pnpm Workspaces + Turborepo** monorepo:

- **Storefront (`apps/storefront`):** React 19, TypeScript, Vite 8, React Router 7, TanStack Query 5, Redux Toolkit, WAI-ARIA APG combobox (`useCombobox`), lazy-loaded React InstantSearch `/search`, and `en` / `pt-BR` i18n.
- **API & Worker (`apps/api`):** Modular monolith built with NestJS 11, Fastify 5, Drizzle ORM, PostgreSQL 17 (`pgvector`), SeaweedFS (S3-compatible media storage), Meilisearch (hybrid lexical + semantic search), transactional Postgres outbox + worker entrypoint, Mailpit (local SMTP), and optional local Ollama (`embeddinggemma-2` 768d) embeddings.
- **Shared Packages (`packages/*`):** `@minieshop/contracts` (strict server / tolerant client Zod schemas), `@minieshop/config` (shared TS/ESLint/Prettier base configs), and `@minieshop/email` (React Email templates).

---

## 1. Prerequisites

- **Docker with Compose v2** (OrbStack or Docker Desktop) — required to run the full containerized stack.
- **Node.js `>=26`** (see [`.nvmrc`](./.nvmrc)) and **`pnpm@12.21.0`** — required only when running host-side workspace commands (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, or hybrid host dev).

---

## 2. How to Run the Project (Step by Step)

### Step 1 — Create the root environment file

Copy the single root template to `.env` (never commit `.env`):

```bash
cp .env.example .env
```

### Step 2 — Build and start the standard stack

```bash
docker compose up -d --build
```

What happens automatically in dependency order:
1. Core infrastructure starts: `postgres`, `storage` (SeaweedFS), `search` (Meilisearch), and `mailpit`.
2. One-shot initialization containers run to completion (`Exited (0)`):
   - `init-buckets` creates the public and private S3 buckets in SeaweedFS.
   - `init-search` configures the Meilisearch `products` index (PT-BR synonyms + `userProvided` semantic embedder) and writes scoped least-privilege keys to `meili_keys`.
   - `migrate` runs all versioned Drizzle SQL migrations (`apps/api/drizzle/`) against PostgreSQL.
3. Application services start once dependencies are healthy/completed: `api` (`:3001`), `worker` (internal `:3002`), and `storefront` (`:5199`).

Verify every long-running service is `healthy` and one-shot init containers exited with `0`:

```bash
docker compose ps
```

### Step 3 — Seed the sample catalog (first run only)

Populate the 30 sample products, 21 categories (5 roots + 16 subcategories), WebP image variants in SeaweedFS, multi-currency overrides/rates, recommendations, and default dev admin user:

```bash
docker compose --profile seed run --rm seed
```

Wait for the background worker to drain the outbox (indexing products into Meilisearch and computing recommendations):

```bash
docker compose exec -T worker pnpm outbox:wait-drain --consumers=search-index,catalog-category-fanout,recommendations --timeout=60000
```

> **One-command clean reset (recreates volumes, migrates, seeds, and drains the outbox):**
> ```bash
> make -C infra reset
> ```

### Step 4 — Access the running services

| Service | Host URL | Purpose |
| :--- | :--- | :--- |
| **Storefront (SPA)** | http://localhost:5199 | Customer-facing React app (catalog, `/search`, PDP, `/cart`, recommendations) |
| **API HTTP** | http://localhost:3001/health & http://localhost:3001/products | NestJS + Fastify REST API (`GET /ready` verifies PostgreSQL readiness) |
| **SeaweedFS S3 Gateway** | http://localhost:8333 | Public browser-accessible WebP product images (`minieshop-catalog-public`) |
| **SeaweedFS Filer / Master** | http://localhost:8888 / http://localhost:9333 | Local storage inspection UIs |
| **Meilisearch** | http://127.0.0.1:7700 | Search engine debug endpoint (browser never talks to Meilisearch directly) |
| **Mailpit Web UI** | http://127.0.0.1:8025 | Captures transactional emails sent over local SMTP (`127.0.0.1:1025`) |

### Step 5 (Optional) — Enable Local AI Embeddings & Hybrid Search (`profile: ai`)

By default, the stack runs without Ollama: search operates cleanly in Meilisearch `keyword` mode and recommendations use deterministic rules. To enable vector embeddings (`embeddinggemma-2`, 768d, Apache 2.0) and hybrid semantic search:

**Option A — Containerized Ollama (zero host install, ~5.6 GB disk, CPU-only on macOS):**

```bash
# 1. Start Ollama and pull embeddinggemma-2
docker compose --profile ai up -d --build

# 2. If you already seeded before enabling AI (initial embedding jobs may be marked dead),
#    backfill all published products non-destructively and wait for downstream indexing:
docker compose exec -T worker pnpm embeddings:reindex
docker compose exec -T worker pnpm outbox:wait-drain --consumers=search-index,embeddings,catalog-category-fanout,recommendations --timeout=240000
docker compose exec -T worker pnpm relations:rebuild
```

> **Destructive clean reset with AI (wipes and recreates all 5 volumes, re-seeds, and rebuilds vectors):**
> ```bash
> make -C infra reset-ai
> ```

**Option B — Native Host Ollama (recommended on Apple Silicon / GPU hosts for fast latency):**

Install [Ollama](https://ollama.com) natively on the host, pull the model once (`ollama pull embeddinggemma-2`), and point `.env` to your host before starting the standard stack (without `--profile ai`):

```dotenv
EMBEDDINGS_BASE_URL=http://host.docker.internal:11434
```

### Step 6 (Optional) — Hot Reload or Hybrid Host Development

- **Containerized hot reload (`develop.watch`):**
  ```bash
  docker compose watch
  ```
- **Run Storefront natively on host (against containerized API):**
  ```bash
  pnpm install
  pnpm dev:storefront
  ```
- **Run API natively on host (against containerized Postgres, SeaweedFS, Meilisearch, and Worker):**
  ```bash
  # Stop only the containerized API to free host port 3001 (keep postgres, storage, search, mailpit, and worker running)
  docker compose stop api

  set -a && source .env && set +a && \
    DATABASE_URL=postgresql://minieshop:minieshop_dev_password@localhost:5432/minieshop \
    S3_ENDPOINT=http://localhost:8333 \
    MEILI_HOST=http://localhost:7700 \
    MEILI_API_KEY="$MEILI_MASTER_KEY" \
    pnpm dev:api
  ```

---

## 3. Docker Architecture: Images, Containers, and Volumes

### Service Topology

```mermaid
flowchart TB
  Browser["Browser (localhost)"]

  subgraph StandardStack["Standard Stack (docker compose up)"]
    SF["storefront\nimage: minieshop-storefront:dev\n:5199"]
    API["api\nimage: minieshop-api:dev\n:3001"]
    WRK["worker\nimage: minieshop-api:dev\ninternal :3002"]
    PG["postgres\npgvector/pgvector:pg17\n:5432"]
    MIG["migrate (one-shot)\nimage: minieshop-api:dev"]
    S3["storage\nchrislusf/seaweedfs:3.85\n:8333 / :9333 / :8888"]
    BKT["init-buckets (one-shot)\nchrislusf/seaweedfs:3.85\ntmpfs /data"]
    MS["search\ngetmeili/meilisearch:v1.57.0\n127.0.0.1:7700"]
    IMS["init-search (one-shot)\nimage: minieshop-api:dev"]
    MP["mailpit\naxllent/mailpit:v1.24.1\n127.0.0.1:1025 / :8025"]
  end

  subgraph OptionalProfiles["Optional Profiles"]
    SEED["seed (profile: seed, one-shot)\nimage: minieshop-api:dev"]
    EMB["embeddings (profile: ai)\nollama/ollama:0.40.17\n127.0.0.1:11434"]
    IEMB["init-embeddings (profile: ai, one-shot)\nollama/ollama:0.40.17"]
  end

  subgraph Volumes["Named Persistent Volumes"]
    VPG[("minieshop_postgres_data\n/var/lib/postgresql/data")]
    VS3[("minieshop_seaweedfs_data\n/data")]
    VMS[("minieshop_meilisearch_data\n/meili_data")]
    VMK[("minieshop_meili_keys\n/run/meili-keys")]
    VOL[("minieshop_ollama_data\n/root/.ollama")]
  end

  Browser -->|"HTTP :5199"| SF
  Browser -->|"fetch + cookies :3001"| API
  Browser -->|"WebP media :8333"| S3
  Browser -.->|"Email UI :8025"| MP

  PG --- VPG
  S3 --- VS3
  MS --- VMS
  IMS -->|"rw"| VMK
  API -->|"ro"| VMK
  WRK -->|"ro"| VMK
  EMB --- VOL

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

### 3.1 Docker Images Inventory

All five backend services (`api`, `worker`, `migrate`, `init-search`, `seed`) share **one single built image (`minieshop-api:dev`)** via the `x-api-image` YAML anchor in [`infra/compose.yaml`](./infra/compose.yaml), avoiding redundant multi-gigabyte image builds.

| Image | Source / Build Context | Used By Containers | Notes |
| :--- | :--- | :--- | :--- |
| **`minieshop-api:dev`** | Built from `apps/api/Dockerfile` (`node:26-slim` + `turbo prune @minieshop/api --docker`) | `api`, `worker`, `migrate`, `init-search`, `seed` | Installs workspace deps with `pnpm --frozen-lockfile` and pre-builds `@minieshop/contracts` and `@minieshop/email`. Runs TypeScript directly via `tsx`. |
| **`minieshop-storefront:dev`** | Built from `apps/storefront/Dockerfile` (`target: development`, `turbo prune @minieshop/storefront --docker`) | `storefront` | Pre-builds `@minieshop/contracts` and serves the SPA through Vite dev server on `:5199`. *(A separate `target: production` builds a ~50 MB `nginx:1.27-alpine` image.)* |
| **`pgvector/pgvector:pg17`** | Official Docker Hub image | `postgres` | PostgreSQL 17 compiled with the `pgvector` extension (HNSW cosine similarity indexes). |
| **`chrislusf/seaweedfs:3.85`** | Official Docker Hub image (Apache 2.0) | `storage`, `init-buckets` | Lightweight S3-compatible object storage (`master` + `volume` + `filer` + `s3` gateway in one process). |
| **`getmeili/meilisearch:v1.57.0`** | Official Docker Hub image (MIT) | `search` | Search engine supporting lexical typo-tolerance, PT-BR synonyms, and `userProvided` hybrid vector search. |
| **`axllent/mailpit:v1.24.1`** | Official Docker Hub image | `mailpit` | Local SMTP sink (`:1025`) and inspection web UI (`:8025`) for transactional auth emails. |
| **`ollama/ollama:0.40.17`** | Official Docker Hub image (~4.33 GB, profile `ai` only) | `embeddings`, `init-embeddings` | Local model runtime for `embeddinggemma-2` (768d, Apache 2.0). Not pulled or started unless `--profile ai` is used. |

### 3.2 What Happens Inside Each Container

| Container | Lifecycle | Command / Process Inside Container | What It Actually Does | Dependencies & Healthcheck |
| :--- | :--- | :--- | :--- | :--- |
| **`postgres`** | Long-running | PostgreSQL 17 server (`pgvector:pg17`) | Hosts the single source of truth database (`minieshop`) organized into 6 isolated module schemas (`catalog`, `identity`, `inventory`, `media`, `platform`, `recommendations`) plus `pgvector` and `unaccent` extensions. | `pg_isready -U minieshop -d minieshop` |
| **`storage`** | Long-running | `weed server -dir=/data -master.port=9333 -volume.port=8080 -filer -s3 -s3.config=/etc/seaweedfs/s3.json` | Runs SeaweedFS master, volume, filer, and S3 gateway in one container. Applies `s3.json` IAM rules: public anonymous read on `minieshop-catalog-public`, authenticated admin write/read on all buckets. | Probes Master `:9333/cluster/status` and Filer `:8888/` |
| **`init-buckets`** | One-shot (`restart: 'no'`) | `/bin/sh -ec` loop calling `weed shell -master=storage:9333` | Waits for SeaweedFS filer/S3 readiness and idempotently runs `s3.bucket.create` for `minieshop-catalog-public` and `minieshop-private`, then exits `0`. Mounts ephemeral `tmpfs:/data` so the upstream `VOLUME /data` declaration never leaks anonymous volumes. | Waits for `storage` healthy |
| **`search`** | Long-running | Meilisearch server (`MEILI_ENV=development`, bound to `127.0.0.1:7700`) | Serves lexical and hybrid vector search queries internally on the Docker network. Bound to host loopback only so browsers never query Meilisearch directly. | `curl -fsS http://127.0.0.1:7700/health \| grep -q available` |
| **`init-search`** | One-shot (`restart: 'no'`) | `pnpm search:init` (`apps/api/src/cli/search-init.ts`) | Uses `MEILI_MASTER_KEY` to create/configure the `products` index (searchable/filterable/sortable attributes, PT-BR synonyms, `localizedAttributes: ['por']`, `userProvided` 768d embedder) and writes two deterministic least-privilege keys (`search.key`, `worker.key`) into `/run/meili-keys`. | Waits for `search` healthy |
| **`migrate`** | One-shot (`restart: 'no'`) | `pnpm db:migrate` (`apps/api/src/database/migrate.ts`) | Applies pending SQL migrations from `apps/api/drizzle/0000..0011` in order into PostgreSQL and exits `0`. | Waits for `postgres` healthy |
| **`seed`** | Profile `seed` (`--rm`) | `pnpm db:seed` (`apps/api/src/seed/seed.ts`) | Idempotently inserts 21 categories, 30 products, variants, stock items, currency exchange rates/overrides, category complements, manual recommendation pairs, and the dev admin staff account; processes local seed PNGs with `sharp` into WebP (`thumb`/`card`/`detail`) + base64 placeholders, uploads to SeaweedFS, and enqueues `product.changed` events in `platform.outbox`. | Waits for `postgres`, `migrate`, `init-buckets` |
| **`mailpit`** | Long-running | `/mailpit` | Listens for SMTP traffic on `:1025` (internal `mailpit:1025`) and serves a web UI/REST API on `127.0.0.1:8025` for inspecting verification and password-reset emails. | `/mailpit readyz` |
| **`api`** | Long-running | `pnpm dev` (`tsx watch src/main.ts`) | Boots NestJS + Fastify on `:3001`, validates env & security config, mounts `/run/meili-keys/search.key` read-only (never holds `MEILI_MASTER_KEY`), serves catalog, pricing quote, search (with circuit breaker + LRU vector cache), recommendations, favorites, and customer/staff auth APIs. Syncs `apps/api/src` live under `docker compose watch`. | Waits for `postgres`, `migrate`, `init-buckets`, `search`, `init-search`; probes `GET /health` |
| **`worker`** | Long-running | `pnpm worker:dev` (`tsx src/worker/main.ts`) | Boots headless NestJS `ApplicationContext` + internal HTTP `/health` on `:3002`. Polls `platform.outbox` (`FOR UPDATE SKIP LOCKED`, 500ms interval, exponential backoff + jitter) to run 5 consumers (`search-index`, `embeddings`, `recommendations`, `catalog-category-fanout`, `mailer`), cleans old processed outbox rows hourly, and runs advisory-locked expired session cleanup every 15 minutes. Uses `/run/meili-keys/worker.key:ro`. | Waits for `postgres`, `migrate`, `search`, `init-search`, `mailpit`; probes `:3002/health` |
| **`storefront`** | Long-running | `pnpm exec vite --host 0.0.0.0 --port 5199 --strictPort` | Runs Vite dev server with `VITE_API_URL=http://localhost:3001` and `DOCKER=true`. Serves the React 19 SPA on `127.0.0.1:5199`. Syncs `src/`, `public/`, and `index.html` under `docker compose watch`. | Waits for `api` healthy; probes `GET :5199/` |
| **`embeddings`** | Profile `ai` (long-running) | `/bin/ollama serve` | Runs the Ollama inference daemon on `127.0.0.1:11434` (internal `http://embeddings:11434`), serving `/api/embed` calls from `worker` (document vectors) and `api` (query vectors). | `ollama list` |
| **`init-embeddings`** | Profile `ai` (one-shot) | `ollama pull "$EMBEDDINGS_MODEL"` | Connects to `embeddings:11434` and pulls `embeddinggemma-2` (~1.3 GB) into `minieshop_ollama_data` if not already cached, then exits `0`. | Waits for `embeddings` healthy |

### 3.3 Persistent Volumes & Mounts Explained

| Volume / Mount | Mounted In (Path & Mode) | What Lives Inside | Safe to Delete? |
| :--- | :--- | :--- | :--- |
| **`minieshop_postgres_data`** | `postgres` → `/var/lib/postgresql/data` (`rw`) | All PostgreSQL cluster data: 6 schemas (`catalog`, `identity`, `inventory`, `media`, `platform`, `recommendations`), Drizzle migration history, HNSW vector embeddings, and optional `app_test` DB. | Recreated cleanly via `make -C infra reset` (wipes local DB data). |
| **`minieshop_seaweedfs_data`** | `storage` → `/data` (`rw`) | SeaweedFS master metadata, volume blobs, filer metadata, and uploaded WebP image variants in `minieshop-catalog-public` / `minieshop-private`. | Recreated cleanly via `make -C infra reset` (re-uploads seed images). |
| **`minieshop_meilisearch_data`** | `search` → `/meili_data` (`rw`) | Disposable derived search index (`products`), PT-BR synonym settings, embedder config, and scoped API key definitions. | Fully disposable — rebuilt from PostgreSQL via `init-search` + `search:reindex` (or `reset`). |
| **`minieshop_meili_keys`** | `init-search` (`rw`), `api` (`ro`), `worker` (`ro`) → `/run/meili-keys` | Two small plaintext key files (`search.key`, `worker.key`, ~130 B total) implementing least-privilege Meilisearch access without exposing `MEILI_MASTER_KEY` to runtime containers. | Recreated automatically on next `init-search` run. |
| **`minieshop_ollama_data`** | `embeddings` → `/root/.ollama` (`rw`) | Cached Ollama model manifests and GGUF weights (`embeddinggemma-2`, ~1.3 GB) so restarts do not re-download the model. | Deleting forces a fresh ~1.3 GB download next time `--profile ai` starts. |
| **Bind mount:** `./infra/seaweedfs/s3.json` | `storage` → `/etc/seaweedfs/s3.json` (`ro`) | Declarative S3 IAM policy granting anonymous public read on `minieshop-catalog-public` and admin credentials for the backend. | Tracked in Git (do not delete). |
| **Ephemeral `tmpfs`:** `/data` | `init-buckets` → `/data` (RAM) | Empty scratch mount overriding SeaweedFS's upstream `VOLUME /data` so one-shot bucket initialization never leaves behind orphaned anonymous volumes. | Ephemeral (automatically discarded on container exit). |

### 3.4 Keeping Local Docker Clean

Rebuild iterations can leave behind untagged dangling images (`<none>`) and BuildKit cache layers. Clean them safely **without** removing active `minieshop_*` volumes or unrelated projects:

```bash
# Remove dangling (<none>) intermediate/superseded images only
docker image prune -f

# Reclaim unused BuildKit build cache (keeps running containers and volumes intact)
docker builder prune -f

# Stop and remove minieshop containers while keeping all 5 named volumes
docker compose down

# Stop and remove minieshop containers AND all 5 named volumes (full wipe)
docker compose --profile ai down -v --remove-orphans
```

---

## 4. Monorepo Map

```text
react-minieshop/
├── apps/
│   ├── storefront/          # React 19 + Vite 8 + React Router 7 + TanStack Query + Redux Toolkit
│   └── api/                 # NestJS 11 + Fastify 5 + Drizzle + Outbox Worker + 13 operational CLIs
├── packages/
│   ├── contracts/           # Shared Zod schemas (.strict() server outputs / .strip() client parsers)
│   ├── config/              # Shared TypeScript, ESLint, and Prettier base configurations
│   └── email/               # Transactional React Email templates rendered by the API worker
├── infra/
│   ├── compose.yaml         # Full Docker Compose stack, profiles (seed, ai), and healthchecks
│   ├── Makefile             # Operational shortcuts (up, up-ai, watch, seed, test, reset, reset-ai)
│   ├── README.md            # Infrastructure-focused reference
│   └── seaweedfs/s3.json    # Declarative local SeaweedFS S3 IAM policy
├── docs/
│   ├── README.md            # Incremental documentation hub
│   ├── design-patterns.md   # Living project-wide design patterns catalog (frontend, backend, contracts)
│   ├── architecture.md      # Module diagrams, outbox topology, and data flows
│   ├── api.md               # Public HTTP API contracts and dev chaos guide
│   ├── db-model.md          # Database schema documentation
│   ├── adr/                 # Architecture Decision Records (ADR-0001..ADR-0022)
│   ├── metrics/             # Empirical benchmarks (search relevance, recommendations, storefront perf)
│   └── sdd/                 # Spec-Driven Development specifications
├── compose.yaml             # Root Docker Compose wrapper (includes infra/compose.yaml)
├── .env.example             # Single source of truth for local environment variables
├── pnpm-workspace.yaml      # pnpm workspace packages and native build allowlist
└── turbo.json               # Turborepo task graph and cache configuration
```

---

## 5. Origin Topology, CORS, and `SameSite` Cookies

- In local development, the storefront runs on `http://localhost:5199` and the API on `http://localhost:3001`.
- Although they are **cross-origin** (different ports require explicit CORS via `CORS_ORIGINS=http://localhost:5199` and `credentials: 'include'`), both share the same registrable domain (`localhost`), so browsers classify them as **same-site**.
- Because they are same-site, `HttpOnly; SameSite=Lax` cookies (`anon_id` for anonymous favorites, `sid_customer` / `sid_staff` for sessions) are stored and sent normally across `fetch(..., { credentials: 'include' })`, and browsers automatically include the `Origin` header on state-changing requests (`POST`, `PATCH`, `PUT`, `DELETE`).
- **Production cross-site note:** If the storefront and API ever live on different eTLD+1 domains (e.g., `https://shop.example.com` and `https://api.other-domain.com`), `SameSite=Lax` cookies will not be sent cross-site. Prefer deploying both under the same eTLD+1 (`shop.example.com` + `api.example.com`) or behind a single reverse proxy/BFF (`/api`), keeping `SameSite=Lax; Secure; HttpOnly` (`__Host-` cookie prefix).

---

## 6. Useful Commands

### Workspace Development & Quality (`pnpm` + Turborepo)

```bash
pnpm install              # Install all workspace dependencies (single root lockfile)
pnpm build                # Topological build across packages and apps
pnpm lint                 # ESLint (api + contracts) and Oxlint (storefront)
pnpm typecheck            # Strict TypeScript checks across the monorepo
pnpm test                 # API unit tests (node:test) + Storefront Vitest/axe/Profiler suites
pnpm dev:storefront       # Run storefront Vite dev server on host (:5199)
pnpm --filter @minieshop/api test:integration   # API Vitest HTTP + Postgres + Meilisearch specs
pnpm --filter @minieshop/storefront metrics     # Playwright runtime & bundle-split metrics
```

### Docker Compose & Makefile Shortcuts

```bash
docker compose up -d --build     # Start standard stack in background
docker compose --profile ai up -d --build  # Start stack with containerized Ollama embeddings
docker compose watch             # Run stack with live file sync for API & Storefront
docker compose ps                # Inspect container health and exit codes
docker compose logs -f api       # Tail API logs (or worker / storefront / search)
docker compose down              # Stop containers while preserving volumes
make -C infra reset              # Wipe volumes, rebuild, migrate, seed, and drain outbox
make -C infra reset-ai           # Same as reset, plus Ollama + vector embeddings & relations
```

### Storefront Production Container Build (Nginx)

```bash
docker build -f apps/storefront/Dockerfile --target production \
  --build-arg VITE_API_URL=http://localhost:3001 \
  -t minieshop-storefront:prod .
```

---

## 7. Troubleshooting

1. **Port already in use (`5199`, `3001`, `5432`, `7700`, `8333`):**
   Override `STOREFRONT_PORT`, `POSTGRES_PORT`, `MEILI_PORT`, or `S3_PORT` in root `.env`. If changing the host API port, keep the internal container port/healthcheck aligned and update both `VITE_API_URL` and `CORS_ORIGINS` in `.env`.
2. **Empty catalog at http://localhost:5199 on first boot:**
   Run `docker compose --profile seed run --rm seed` (or `make -C infra reset`).
3. **CORS errors or favorites not persisting:**
   Ensure `CORS_ORIGINS` matches `http://localhost:5199` exactly (no trailing slash) and do not mix `127.0.0.1` and `localhost` between browser URL and `VITE_API_URL`.
4. **Simulating API latency or failures in DEV (Chaos Middleware):**
   Ensure `CHAOS_ENABLED=true` and `NODE_ENV=development` in `.env`, then use the floating DEV Chaos panel in the storefront or set `localStorage.setItem('chaos.delay', '800')` / `localStorage.setItem('chaos.fail', '1')`.
5. **Testing media fallback during storage outage:**
   Run `docker compose stop storage` and reload the storefront to verify inline SVG fallbacks (`ProductImage`), then restore with `docker compose start storage`.
6. **Slow hybrid search (~2.6s) on macOS with `--profile ai`:**
   Docker Linux VMs on macOS run Ollama on CPU only. Use native host Ollama with Metal GPU (`EMBEDDINGS_BASE_URL=http://host.docker.internal:11434`) or let the API fall back to Meilisearch `keyword` mode (`~2ms`).
