# ADR-0013 — Recomendações Pré-Calculadas em Tabela, Curadoria Manual e Fallback por Regra *(spec ADR-007)*

- **Status:** Accepted
- **Date:** 2026-11-22
- **Phase:** Backend Fase 4 (`R01`)

---

## Contexto

O catálogo do **Progressive Minie Shop** já conta com embeddings de produtos persistidos em `catalog.product_embeddings` (`pgvector` `0.8.7`, `vector(768)`, modelo `embeddinggemma`, índice HNSW com `vector_cosine_ops`, conforme [`ADR-0011`](./0011-pipeline-unico-de-embeddings-pgvector.md)) e um pipeline transacional de outbox + worker (`platform.outbox`, [`ADR-0012`](./0012-outbox-postgres-e-worker-segundo-entrypoint.md)).

Precisamos entregar recomendações de produtos na PDP (`related`, `upsell`, `cross_sell`) e no carrinho (`cross_sell` agregado) atendendo simultaneamente a quatro restrições de produção:

1. **Baixa latência e previsibilidade na leitura:** sem executar consultas kNN pesadas a cada requisição HTTP.
2. **Controle editorial:** curadoria manual (`source = 'manual'`) sempre prevalece sobre automação (`source = 'auto'`).
3. **Frescor de estoque e publicação:** produtos sem estoque ou despublicados nunca aparecem nas respostas públicas, mesmo quando o estoque oscila com frequência.
4. **Resiliência sem IA:** o ambiente padrão (`make -C infra up`, sem profile `ai`/Ollama) deve continuar entregando recomendações úteis por meio de fallback determinístico por regra (`method = 'rule'`).

---

## Decisão

### 1. Relações Pré-Calculadas no Schema `recommendations`

- As relações são calculadas de forma assíncrona no **worker** (`RelationsService.recompute(productId)`) e armazenadas em `recommendations.product_relations`.
- A leitura na API **não executa kNN em tempo real**: lê apenas os IDs já ordenados (`source = 'manual'` primeiro por `position ASC`, depois `source = 'auto'` por `score DESC`), faz **sobrebusca** sobre o pool armazenado, **hidrata** os cards via interface pública de `catalog` (somente `status = 'published'`, preço e estoque sempre atuais), descarta itens com `inStock = false` (salvo quando `includeOutOfStock=true` para depuração) e corta no limite solicitado.
- **Pool armazenado maior que o limite de leitura:** o job grava um pool configurável maior que o teto público de leitura (`12`), absorvendo eventuais quedas de estoque sem exigir recálculo imediato:
  - `related`: limite default de leitura `8` (máx. `12`), pool armazenado `20`.
  - `upsell`: limite default de leitura `4` (máx. `12`), pool armazenado `12`.
  - `cross_sell`: limite default de leitura `6` (máx. `12`), pool armazenado `16`.
- **Curadoria manual prevalece sempre:** o job (`auto`) apaga e reescreve apenas linhas `source = 'auto'`, nunca sobrescreve nem duplica triplas `(product_id, related_product_id, type)` já cadastradas como `manual`. Se uma curadoria manual é criada para uma tripla já existente como `auto`, a linha é convertida em `manual` (`method = 'manual'`, `score = NULL`).
- **Isolamento de módulos ([`ADR-0006`](./0006-organizacao-banco-schemas-por-modulo.md)):** o módulo `recommendations` escreve somente em `recommendations.*` e lê produtos, categorias e vizinhos vetoriais exclusivamente pela interface pública do módulo `catalog` (`CatalogService`), sem JOIN entre schemas. As FKs de `recommendations.product_relations` e `recommendations.category_complements` apontam apenas para chaves primárias (`catalog.products.id` e `catalog.categories.id`, `ON DELETE CASCADE`).

---

### 2. Regras de Cada Tipo de Recomendação

O job considera apenas produtos **publicados** (`status = 'published'`) e nunca gera auto-relação (`product_id <> related_product_id`).

#### 2.1 `related` (Produtos Parecidos)
- **Com vetores (`method = 'vector'`):**
  - Busca os vizinhos mais próximos por similaridade de cosseno (`1 - (embedding <=> target)`), filtrando candidatos com `similarity >= RECOMMENDATIONS_RELATED_MIN_SIMILARITY` (default `0.45`).
  - **Preferência hierárquica:** ordena primeiro candidatos da **mesma categoria folha**, depois de **categorias irmãs** (mesmo `parent_id`), e por fim demais categorias publicadas que superem o limiar — sempre ordenados por similaridade decrescente dentro de cada faixa.
- **Fallback por regra (`method = 'rule'`, quando o produto não possui embedding):**
  - Prioriza mesma categoria folha, depois categorias irmãs (mesmo pai).
  - Ranqueia por proximidade de preço efetivo (`1 / (1 + |p_cand - p_src| / max(p_src, 1))`, peso `0.7`) combinada com recência normalizada (`created_at`, peso `0.3`), produzindo score determinístico em `(0, 1]`.

#### 2.2 `upsell` (Alternativa Superior na Mesma Categoria)
- **Escopo estrito:** apenas produtos da **mesma categoria folha** (`category_id` idêntico), preservando coerência semântica (aceita lista vazia quando o produto já é o topo da sua subcategoria ou é o único item dela).
- **Faixa de preço efetivo (`COALESCE(special_price_cents, regular_price_cents)`):** configurável via variáveis de ambiente:
  - `RECOMMENDATIONS_UPSELL_MIN_RATIO` — default **`1.10`** (+10% mínimo, evitando sugerir itens de preço praticamente igual como upsell).
  - `RECOMMENDATIONS_UPSELL_MAX_RATIO` — default **`2.50`** (até 2,5x o preço base, evitando saltos irreais como um organizador de R\$ 85 sugerindo uma cadeira de R\$ 899 ou um carregador de R\$ 109 sugerindo um tablet de R\$ 1.799).
- **Com vetores (`method = 'vector'`):** filtra por `similarity >= RECOMMENDATIONS_UPSELL_MIN_SIMILARITY` (default `0.50`) e ordena por similaridade decrescente.
- **Fallback por regra (`method = 'rule'`):** mantém o filtro estrito de mesma categoria folha e faixa `1.10x–2.50x`, ordenando por proximidade ao degrau ideal de preço (`1.35x` do preço base) e recência.

#### 2.3 `cross_sell` (Produtos Complementares)
- **Mapa de categorias complementares (`recommendations.category_complements`):** regras direcionadas `(category_id -> complement_category_id, position)` mantidas em tabela (editável no futuro backoffice) e populadas de forma idempotente a partir de um arquivo JSON versionado no seed.
- **Herança por subcategoria:** para um produto na categoria `C` (com pai `P`), as regras diretas de `C` têm prioridade (ordenadas por `position`), seguidas pelas regras herdadas de `P` (deduplicadas por `complement_category_id`, excluindo `C`). Quando `complement_category_id` é uma categoria raiz, inclui todos os seus descendentes publicados.
- **Ranqueamento e diversidade:**
  - **Com vetores (`method = 'vector'`):** candidatos de cada categoria complementar são ranqueados pela similaridade de cosseno (sem corte rígido de limiar, pois categorias complementares são semanticamente distintas por definição — ex.: fone de ouvido + mochila).
  - **Fallback por regra (`method = 'rule'`):** candidatos de cada categoria complementar são ranqueados por proximidade de preço razoável e recência.
  - **Diversidade:** no máximo **`RECOMMENDATIONS_CROSS_SELL_MAX_PER_CATEGORY`** (default **`2`**) itens por categoria complementar, selecionados em rodadas (round-robin pela `position` da regra complementar) para garantir variedade no topo da lista.
- **Evolução futura (`source = 'behavior'`):** quando o domínio de pedidos (`orders`) existir, recomendações baseadas em co-ocorrência de compras ("quem comprou X também comprou Y") serão adicionadas estendendo o `CHECK` de `source` com `'behavior'`, coexistindo com `manual` e `auto`.

---

### 3. Escolha Empírica dos Limiares de Similaridade (Seed de 30 Produtos)

Os limiares **não foram escolhidos arbitrariamente**. Medimos a distribuição completa de similaridade de cosseno (`1 - (e1 <=> e2)`) dos 870 pares ordenados entre os 30 produtos publicados do seed usando `embeddinggemma` (`768` dims, `pgvector 0.8.7`):

#### Distribuição por escopo de categoria

| Escopo | Pares | Min | p10 | p25 | **p50 (Mediana)** | p75 | p90 | Max |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `same_leaf` (mesma subcategoria) | 34 | 0.4330 | 0.4496 | 0.5351 | **0.6061** | 0.6270 | 0.6788 | 0.7250 |
| `sibling` (mesma categoria raiz) | 170 | 0.3676 | 0.4082 | 0.4305 | **0.4607** | 0.5003 | 0.5401 | 0.6190 |
| `other_root` (outra raiz) | 666 | 0.2767 | 0.3551 | 0.3833 | **0.4123** | 0.4470 | 0.4927 | 0.6837 |

#### Distribuição por posição do vizinho mais próximo (Top-8 por produto)

| Rank do Vizinho | Min | p25 | **p50 (Mediana)** | Max |
| :---: | :---: | :---: | :---: | :---: |
| #1 | 0.5089 | 0.5766 | **0.6149** | 0.7250 |
| #2 | 0.4778 | 0.5246 | **0.5467** | 0.6795 |
| #3 | 0.4194 | 0.5002 | **0.5215** | 0.6075 |
| #5 | 0.4105 | 0.4693 | **0.4975** | 0.5424 |
| #8 | 0.4075 | 0.4473 | **0.4646** | 0.5053 |

#### Raciocínio da escolha
- **`RECOMMENDATIONS_RELATED_MIN_SIMILARITY = 0.45`:** posiciona-se **acima do percentil 75 de pares sem relação de categoria (`other_root` p75 = `0.4470`)**, descartando ruído entre raízes distintas, enquanto preserva **>90% dos pares `same_leaf`** (`p10 = 0.4496`) e a metade superior dos pares `sibling` (`p50 = 0.4607`).
- **`RECOMMENDATIONS_UPSELL_MIN_SIMILARITY = 0.50`:** analisando os 17 pares `same_leaf` com preço crescente no seed, pares genuínos de upgrade (ex.: `earbuds -> fone-over-ear` `0.7250`, `mochila -> mala-duffle` `0.6141`, `moletom -> jaqueta` `0.6149`, `drone -> camera` `0.6581`, `oculos-luz-azul -> oculos-sol` `0.6232`) ficam todos acima de `0.5351`, enquanto falsos upsells dentro da mesma folha (ex.: `carteira -> garrafa-termica` `0.4330` e `mouse -> teclado` `0.4472`) são filtrados automaticamente pelo corte em `0.50`.
- **Limitação explícita:** o catálogo do seed possui apenas **30 produtos** em 15 subcategorias folha (várias com 1–2 itens). Em catálogos maiores (centenas ou milhares de SKUs), a densidade de vizinhos próximos aumenta e ambos os limiares podem ser ajustados via variável de ambiente sem alteração de código nem nova migration.

---

### 4. Parâmetros Configuráveis (Env)

| Variável | Default | Finalidade |
| :--- | :---: | :--- |
| `RECOMMENDATIONS_RELATED_MIN_SIMILARITY` | `0.45` | Similaridade mínima de cosseno para `related` (`method = 'vector'`) |
| `RECOMMENDATIONS_UPSELL_MIN_SIMILARITY` | `0.50` | Similaridade mínima de cosseno para `upsell` (`method = 'vector'`) |
| `RECOMMENDATIONS_UPSELL_MIN_RATIO` | `1.10` | Razão mínima de preço efetivo do candidato sobre o produto base |
| `RECOMMENDATIONS_UPSELL_MAX_RATIO` | `2.50` | Razão máxima de preço efetivo do candidato sobre o produto base |
| `RECOMMENDATIONS_CROSS_SELL_MAX_PER_CATEGORY` | `2` | Teto de itens por categoria complementar (diversidade) |
| `RECOMMENDATIONS_REVERSE_FANOUT_LIMIT` | `20` | Teto de produtos dependentes re-enfileirados na propagação reversa (1 salto, `cascade: false`) |

---

### 5. Execução de kNN com Filtros no `pgvector 0.8.7`

- A imagem fixada no Compose (`pgvector/pgvector:pg17`) entrega **`pgvector 0.8.7`**, que suporta nativamente **`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`** (verificado diretamente no container).
- Com `iterative_scan`, quando o índice HNSW aplica filtros posteriores (`status = 'published'`, `category_id IN (...)`, faixa de preço, exclusão de IDs), o `pgvector` continua expandindo o grafo automaticamente até preencher o `LIMIT` solicitado em vez de devolver listas encolhidas.

---

### 6. Propagação Reversa e Eventos de Outbox

- O evento de gravação de vetor emitido pelo `EmbeddingsOutboxHandler` é generalizado para **`product.embedding_updated`** com inscritos `['search-index', 'recommendations']`.
- O consumidor **`recommendations`** também assina **`product.changed`** (cobrindo alterações de categoria, preço, publicação e o fallback por regra sem IA).
- Ao recomputar um produto `A` a partir de um evento primário (`cascade !== false`), o serviço consulta reversamente `recommendations.product_relations` (`DISTINCT product_id WHERE related_product_id = A LIMIT 20`) e enfileira recomputação apenas para o consumidor `recommendations` com `cascade: false`, garantindo **no máximo 1 salto** (sem loops infinitos nem tempestade de eventos).

---

## Alternativas Consideradas e Descartadas

1. **kNN em tempo real a cada requisição HTTP:** acoplaria a latência da PDP ao índice vetorial, dificultaria a mistura determinística com curadoria manual (`manual` primeiro), desperdiçaria CPU repetindo o mesmo cálculo para cada visitante e ainda exigiria lógica de fallback online quando o profile `ai` estiver desligado.
2. **Serviço externo de recomendação (SaaS / ML dedicado):** violaria o princípio de custo zero, introduziria dependência de rede externa e fugiria da arquitetura de monolito modular com Postgres como fonte da verdade.
3. **Filtragem colaborativa (usuário-item / item-item por comportamento):** inviável na Fase 4 porque ainda não existem tabelas de pedidos, carrinhos persistidos ou histórico de cliques; prevista explicitamente como extensão futura (`source = 'behavior'`).

---

## Consequências

- **Positivas:** leitura da PDP e do carrinho em consulta indexada simples + hidratação em lote no Postgres; curadoria manual sempre protegida; estoque sempre fresco; operação 100% funcional com e sem Ollama (`ai`).
- **Trade-offs:** eventual consistency curta (segundos) entre editar um produto e atualizar suas relações via worker; espaço adicional na tabela `recommendations.product_relations` devido ao pool maior que o limite de leitura.
