# Métricas de Relevância e Latência da Busca (`S09`)

Relatório gerado a partir da execução de `pnpm search:eval` sobre o catálogo completo do seed (`30` produtos publicados) no PostgreSQL 17 (`pgvector`), Meilisearch `v1.57.0` e Ollama `0.40.17` com `embeddinggemma` (`768` dimensões, prefixos assimétricos).

---

## 1. Conjunto de Consultas de Avaliação

Arquivo versionado: [`apps/api/seed/search-eval-queries.json`](../../apps/api/seed/search-eval-queries.json)

- **Total de consultas:** `27` (`24` consultas positivas com slugs esperados + `3` consultas negativas sem resultado esperado).
- **Categorias cobertas:**
  - `exact` (`3`): nome exato do produto.
  - `model` (`3`): modelo/especificação técnica (ex.: `Switch Brown RGB`, `Classic Aviator polarizado`).
  - `no_accent` (`3`): consulta sem acentuação (`oculos luz azul`, `luminaria nordica`, `tenis running`).
  - `typo` (`3`): erro de digitação de 1 caractere (`tecldo mecanico`, `mochil impermeavel`, `cafetera prensa`).
  - `plural` (`3`): flexão de número (`fones bluetooth`, `xicaras de ceramica`, `carteiras de couro`).
  - `synonym` (`3`): sinônimos comerciais PT-BR (`headphone bluetooth`, `speaker waterproof`, `suporte laptop`).
  - `intent` (`6`): consultas semânticas por intenção sem palavras do título (ex.: `trabalhar muitas horas sentado com conforto`, `presente cheiroso para relaxar na sala`).
  - `no_result` (`3`): itens inexistentes no catálogo (`geladeira frost free`, `pneu aro 17`, `racao cachorro`).

---

## 2. Comparação de Relevância e Latência (3 repetições por consulta)

| Configuração | Recall@5 | Recall@10 | MRR | Taxa sem-resultado *(positivas)* | Acerto sem-resultado *(negativas)* | Busca p50 / p95 *(ms)* | Embedding p50 / p95 *(ms, CPU)* |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `postgres_fts` | 0.542 | 0.542 | 0.542 | 45.8% | 100.0% | 1.62 / 6.45 | — |
| `meili_keyword` | 0.833 | 0.833 | 0.833 | 16.7% | 100.0% | 1.66 / 2.52 | — |
| `meili_hybrid_0.3` | **1.000** | **1.000** | **0.979** | **0.0%** | 0.0% | 2.14 / 2.70 | 2587.3 / 2851.3 |
| **`meili_hybrid_0.5`** *(padrão)* | **1.000** | **1.000** | **0.979** | **0.0%** | 0.0% | **2.02 / 2.46** | 2587.3 / 2851.3 |
| `meili_hybrid_0.7` | **1.000** | **1.000** | **0.979** | **0.0%** | 0.0% | 2.01 / 2.81 | 2587.3 / 2851.3 |

---

## 3. Idempotência do `search:reindex`

Verificada automaticamente ao final do `pnpm search:eval` (duas reindexações completas consecutivas com índice temporário + `swapIndexes`):

- `run1Count`: `30`
- `run2Count`: `30`
- `finalIndexCount`: `30`
- `idempotent`: `true`

---

## 4. Escolha do `SEARCH_SEMANTIC_RATIO` Padrão

- **Valor escolhido:** `SEARCH_SEMANTIC_RATIO=0.5`.
- **Justificativa:** no catálogo atual, `0.3`, `0.5` e `0.7` atingem o teto de `Recall@5 = 1.000` e `MRR = 0.979` (salto de `+0.146` em MRR sobre `meili_keyword` e `+0.437` sobre `postgres_fts`), sendo `0.5` o equilíbrio ideal entre precisão lexical (nomes exatos, modelos e códigos) e recall semântico (intenção de uso), além de apresentar o menor `p95` de busca no motor (`2.46 ms`).

---

## 5. Limites Conhecidos e Honestidade Metodológica

1. **Catálogo pequeno (`30` produtos):** com apenas 30 itens, há poucos "quase-concorrentes" por categoria; por isso `0.3`, `0.5` e `0.7` empataram no topo e `Recall@5` saturado em `1.000` tende a se diferenciar mais quando o catálogo crescer para centenas ou milhares de SKUs.
2. **Consultas sem resultado (`no_result`) no modo híbrido:** a busca vetorial pura/híbrida no Meilisearch sempre retorna os vizinhos mais próximos mesmo para termos fora do domínio (`noResultZeroHitRate = 0.0%` vs `100.0%` no lexical). Em produção, recomenda-se calibrar `rankingScoreThreshold` no Meilisearch para cortar resultados de baixa similaridade.
3. **Latência de embedding em CPU (macOS/OrbStack):** a geração do vetor da consulta em container CPU leva ~`2.6s` (`p50`), enquanto o motor em si responde em `~2ms`. Em uso real, isso é mitigado pelo cache LRU em memória para consultas repetidas, pelo timeout curto com degradação automática para `keyword` (`~2ms`), ou pelo uso de Ollama nativo com aceleração Metal/GPU no host (`EMBEDDINGS_BASE_URL=http://host.docker.internal:11434`).
