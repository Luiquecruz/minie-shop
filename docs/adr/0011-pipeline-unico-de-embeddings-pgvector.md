# ADR-0011 — Pipeline Único de Embeddings com pgvector e Embedder `userProvided` *(spec ADR-006)*

- **Status:** Partially Superseded by [ADR-0022](./0022-upgrade-embeddings-model-to-embeddinggemma-2.md) *(model upgraded from `embeddinggemma` to `embeddinggemma-2`; pipeline architecture unchanged)*
- **Date:** 2026-11-22
- **Phase:** Backend Fase 3 (`S01`, atualizado ao final da `S06`)

---

## Contexto

A busca híbrida (Fase 3) e as recomendações semânticas futuras (Fase 4) dependem de representações vetoriais (embeddings) dos produtos do catálogo. Precisamos decidir onde gerar, onde persistir e como distribuir esses vetores sem duplicar inferência, sem custos de API externa e mantendo consistência entre busca e recomendações.

---

## Decisão

1. **Pipeline único de embeddings:**
   - Os embeddings de produtos são gerados localmente via `EmbeddingProvider` (adaptador `OllamaEmbeddingProvider` rodando em container opcional sob o profile Docker Compose `ai`, ou apontando para um Ollama nativo via `EMBEDDINGS_BASE_URL`).
   - Os vetores são persistidos no **PostgreSQL (`catalog.product_embeddings` com `pgvector` e índice HNSW `vector_cosine_ops`)**, que é a fonte da verdade também para vetores.
   - O **Meilisearch recebe os vetores prontos** via embedder `userProvided` (`_vectors.semantic`) enviados pelo worker (`search-index`) e pelo `search:reindex`.
   - Na hora da consulta (`GET /search` em modo `hybrid`), a API gera o vetor da query usando o **mesmo modelo** (com timeout curto e cache LRU em memória).
2. **Controle de idempotência por hash de conteúdo:**
   - Uma função pura monta o texto canônico do produto com `templateVersion` explícito.
   - `content_hash = sha256(model + templateVersion + text)`. Se `model` e `content_hash` não mudaram, o handler de embeddings não chama o modelo novamente.
3. **Provider falso determinístico para testes e CI:**
   - Para não exigir download de modelos pesados no CI nem nos testes rápidos de integração, existe um `DeterministicFakeEmbeddingProvider` que gera vetores normalizados estáveis com a mesma dimensão configurada.

---

## Especificação do Modelo Escolhido *(preenchido na `S06`)*

- **Modelo escolhido:** `embeddinggemma` (Google EmbeddingGemma via Ollama `ollama/ollama:0.40.17`, ~621 MB)
- **Dimensão (`vector(N)`):** `768` (`catalog.product_embeddings.embedding vector(768)` com índice HNSW `vector_cosine_ops`)
- **Template de texto (`templateVersion: "v1"`):**
  ```text
  Produto: {name}
  Categoria: {categoryNames}
  [Marca: {brand}]
  Descrição: {description}
  [Especificações: {attributesText}]
  ```
- **Prefixos (conforme model card oficial do EmbeddingGemma):**
  - **Documento:** `title: {name} | text: {templateText}`
  - **Consulta:** `task: search result | query: {query}`
- **Resultado da comparação empírica (20 consultas de intenção em PT-BR sobre os 30 produtos do seed, CPU em container OrbStack):**

| Modelo | Dimensão | Tamanho | Recall@3 | Recall@5 | MRR | Batch 30 docs (CPU) | Latência Query p50 / p95 (CPU) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `bge-m3` *(sem prefixo)* | 1024 | 1.2 GB | 0.900 | 0.950 | 0.804 | 88.4s | 2630 ms / 3129 ms |
| **`embeddinggemma`** *(prefixos assimétricos)* | **768** | **621 MB** | **0.950** | **0.950** | **0.892** | 111.5s | **2589 ms** / 3138 ms |

**Justificativa:** `embeddinggemma` obteve **+8.8 pontos percentuais em MRR** (`0.892` vs `0.804`) e maior `Recall@3` (`0.950` vs `0.900`) nas consultas de intenção em português, ocupando **metade do espaço em disco/RAM** (`621 MB` vs `1.2 GB`) e **25% menos memória vetorial** (`768` vs `1024` dimensões) no pgvector e no Meilisearch.

---

## Alternativas Consideradas e Descartadas

- **Deixar o próprio Meilisearch gerar os embeddings (embedder `ollama` / `huggingFace`):** duplicaria o pipeline quando as recomendações (Fase 4) precisassem dos mesmos vetores no Postgres, além de acoplar a geração de embeddings ao ciclo de vida do motor de busca.
- **Armazenar vetores apenas no Meilisearch:** violaria o princípio de que o índice é derivado e descartável; qualquer reindexação exigiria recalcular todos os embeddings do zero no modelo.

---

## Consequências

- **Positivas:** um único cálculo por mudança real de conteúdo; reindexação do Meilisearch reaproveita vetores já prontos no Postgres sem chamar o Ollama; Fase 4 (recomendações) lê diretamente de `catalog.product_embeddings` com índice HNSW.
- **Trade-offs:** mudar de modelo ou de dimensão exige migration/atualização de `vector(N)`, reconfiguração do embedder `userProvided` no `init-search` e execução de `embeddings:reindex` + `search:reindex`.
