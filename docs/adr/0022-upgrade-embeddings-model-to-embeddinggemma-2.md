# ADR-0022: Upgrade Local Embedding Model from `embeddinggemma` (v1) to `embeddinggemma-2`

- **Status:** Accepted
- **Date:** 2026-11-26
- **Phase:** Alignment & Infrastructure Cleanup (`chore/docs-and-docker-alignment`)
- **Supersedes (Partially):** [ADR-0011](./0011-pipeline-unico-de-embeddings-pgvector.md) (model selection section only; single-pipeline architecture, pgvector persistence, `userProvided` Meilisearch embedder, content-hash idempotency, and `DeterministicFakeEmbeddingProvider` remain unchanged)

---

## Context

In [ADR-0011](./0011-pipeline-unico-de-embeddings-pgvector.md), `embeddinggemma` (v1, Gemma 3 architecture, 300M parameters, 768 dimensions) was chosen over `bge-m3` (1024 dimensions) after outperforming it in Portuguese intent queries while halving disk/RAM footprint.

Google DeepMind subsequently released **`embeddinggemma-2`** (Gemma 4 architecture, October 2026), natively available in Ollama (`ollama pull embeddinggemma-2`) and compatible with our already-pinned `ollama/ollama:0.40.17` runtime (`requires >= 0.40.4`).

Key gaps in keeping `embeddinggemma` v1:
- **Licensing:** `embeddinggemma` v1 is governed by Google's *Gemma Terms of Use* rather than a standard permissive OSS license.
- **Capabilities:** v1 is text-only with a `2,048`-token context window, whereas `embeddinggemma-2` offers a much larger context window, native Matryoshka Representation Learning (MRL), and multimodal alignment (text, code, images, audio) in the same `768`-dimensional vector space.

---

## Decision

1. **Default model updated to `embeddinggemma-2` (`768` dimensions):**
   - Update `EMBEDDINGS_MODEL` default from `embeddinggemma` to `embeddinggemma-2` in:
     - `apps/api/src/config/env.ts`
     - `.env.example`
     - `infra/compose.yaml` (`api`, `worker`, `init-embeddings`)
2. **Zero schema migration required (`vector(768)` preserved):**
   - Verified live against `ollama/ollama:0.40.17`: `POST /api/embed` with `model: "embeddinggemma-2"` emits `768`-dimensional vectors matching `catalog.product_embeddings.embedding vector(768)` and Meilisearch's `userProvided` `semantic` embedder.
3. **Asymmetric task prefixes retained:**
   - `embeddinggemma-2` uses the exact same `title: {title} | text: {text}` (document) and `task: search result | query: {query}` (query) prefix format. `embedding-text.ts` already matches `normalizedModel.startsWith('embeddinggemma')`, and unit tests now explicitly cover `embeddinggemma-2`.
4. **Model-identity guard & rollout ordering:**
   - `SearchIndexOutboxHandler` and `search:reindex` require `emb.model === EMBEDDINGS_MODEL` in addition to matching `EMBEDDINGS_DIMENSIONS`, preventing stale v1 document vectors from being indexed alongside v2 query vectors.
   - Because `computeEmbeddingContentHash` includes `model`, upgrading an existing environment follows a deterministic non-destructive sequence before serving hybrid traffic: pull `embeddinggemma-2` → `pnpm embeddings:reindex` → `pnpm outbox:wait-drain` (or `pnpm search:reindex`) → `pnpm relations:rebuild`.

---

## Alternatives Considered

- **Stay on `embeddinggemma` (v1):** Smaller model file (`~621 MB` vs `~1.3 GB` Q8_0 multimodal bundle in Ollama), but remains bound to *Gemma Terms of Use* and lacks multimodal/extended-context capabilities.
- **Switch to `bge-m3` (1024d):** Rejected previously in `ADR-0011` for lower PT-BR MRR (`0.804` vs `0.892`) and requiring a `vector(1024)` Postgres migration.

---

## Consequences

### Positive
- **Permissive Apache 2.0 license**, aligning the AI profile with the repository's OSS licensing standard (`ADR-0004`).
- **Drop-in `768`-dimension compatibility** — zero Postgres migration or Meilisearch embedder schema change.
- **Future multimodal path** — opens future visual/image-to-product search and recommendations in the same vector space without replacing the model.
- **No external API cost** — remains 100% local via Ollama.

### Negative / Trade-offs
- **Larger local Ollama model weight** (`~1.3 GB` Q8_0 multimodal GGUF in `minieshop_ollama_data` vs `~621 MB` for v1).
- **Reindexing required** on existing local databases (`embeddings:reindex` + `search:reindex` + `relations:rebuild`) to replace v1 vectors with v2 vectors.

---

## Incremental Evolution Notes

- Future work may evaluate Matryoshka truncation (`512d` / `256d`) if catalog scale grows to tens of thousands of SKUs, or multimodal image embeddings using existing SeaweedFS product images.
