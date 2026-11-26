# Local Infrastructure — Progressive Minie Shop

Containerized local stack defined in [`infra/compose.yaml`](./compose.yaml) (included by the root [`compose.yaml`](../compose.yaml)) and operated via [`infra/Makefile`](./Makefile) or root `docker compose` commands.

For the complete step-by-step startup guide and a detailed breakdown of every image, container lifecycle, and volume, see the root [`README.md`](../README.md).

---

## Environment File Precedence

- **Direct root `docker compose ...` commands:** Read the repository root `.env` (there is no automatic fallback to `.env.example`), so copy the template first:
  ```bash
  cp .env.example .env
  ```
- **`make -C infra <target>` shortcuts:** Follow the fallback order in [`infra/Makefile`](./Makefile): root `.env` → legacy `infra/.env` (if present) → root `.env.example`. Always prefer root `.env` as the single source of truth.

---

## Makefile Shortcuts (`make -C infra <target>`)

| Target | Command Executed | Purpose |
| :--- | :--- | :--- |
| `up` | `docker compose up -d --build` | Starts the standard stack (Postgres, SeaweedFS, Meilisearch, Mailpit, init jobs, API, Worker, Storefront). |
| `up-ai` | `docker compose --profile ai up -d --build` | Starts the standard stack plus containerized Ollama (`embeddings` + `init-embeddings`). |
| `watch` | `docker compose watch` | Starts the stack with live source sync for `apps/api/src` and `apps/storefront/src`. |
| `seed` | `docker compose --profile seed run --rm --build seed` | Idempotently seeds categories, products, WebP images, pricing, recommendations, and dev admin user. |
| `ps` / `logs` / `down` | Standard Compose inspection / stop | Checks health, tails logs, or stops containers while keeping persistent volumes. |
| `test` | `pnpm --filter @minieshop/api test && pnpm --filter @minieshop/api test:integration` | Runs API unit tests and Vitest Postgres + Meilisearch integration specs. |
| `reset` | `down -v` → `up` → `seed` → `outbox:wait-drain` | Full clean rebuild of all volumes, migrations, seed data, search index, and rule recommendations. |
| `reset-ai` | Same as `reset` with `--profile ai` | Full clean rebuild including `embeddinggemma-2` vectors, hybrid search index, and vector recommendations. |

---

## Key Operational Notes

- **Shared backend image (`minieshop-api:dev`):** `api`, `worker`, `migrate`, `init-search`, and `seed` share a single image via the `x-api-image` anchor in `infra/compose.yaml` to avoid building five separate copies of `apps/api/Dockerfile`.
- **Zero anonymous volume leaks:** `init-buckets` mounts `tmpfs: [/data]` so SeaweedFS's upstream `VOLUME /data` instruction never creates orphaned anonymous volumes.
- **Least-privilege Meilisearch keys:** `init-search` writes `search.key` (read-only search) and `worker.key` (document indexing) to `minieshop_meili_keys`, mounted `:ro` in `api` and `worker`. `MEILI_MASTER_KEY` is never passed to `api` or `worker`.
- **Dual S3 endpoints:** Containers upload/read through internal `S3_ENDPOINT=http://storage:8333`, while public image URLs emitted to browsers use `S3_PUBLIC_ENDPOINT=http://localhost:8333`.
- **macOS / OrbStack GPU note:** Linux containers on macOS run Ollama on CPU only. For Apple Silicon Metal acceleration, run Ollama natively on the host and set `EMBEDDINGS_BASE_URL=http://host.docker.internal:11434` in root `.env`.
