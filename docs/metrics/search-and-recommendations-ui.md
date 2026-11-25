# Métricas e Verificação — Busca (S08) e Blocos de Recomendação (R05)

Evidências empíricas coletadas contra o storefront e a API reais (PostgreSQL 17 + `pgvector`, Meilisearch v1.57.0, SeaweedFS e Ollama `embeddinggemma` no perfil `ai`) executando `apps/storefront/scripts/metrics/run-metrics.mjs` com Playwright (`chromium` headless) e inspeção do build Vite de produção (`dist/`).

---

## 1. Resumo Executivo (Fase 7)

| Critério / Métrica | Baseline pré-Fase 7 (`main` `a9eb8f2`) | Pós-Fase 7 (`feat/search-recs-ui`) | Evidência |
| :--- | :--- | :--- | :--- |
| **Chunk principal JS (`index-*.js`)** | `589,476 B` (`169,91 kB` gzip) | `613,225 B` (`175,122 B` gzip zlib) | `+23,749 B` raw / `+5,2 kB` gzip (sem InstantSearch) |
| **Chunk principal CSS (`index-*.css`)** | `68,716 B` (`11,48 kB` gzip) | `72,255 B` (`12,057 B` gzip) | `+3,539 B` raw (`RecommendationCarousel` + `SearchBar` + `SearchResultsPage` styles) |
| **Chunk lazy `/search` JS (`SearchResultsPage-*.js`)** | N/A | `189,186 B` (`52,238 B` gzip) | Carregado **apenas** ao visitar `/search` (`vite preview` + dev) |
| **Chunk lazy `/search` CSS (`SearchResultsPage-*.css`)** | N/A | `3,171 B` (`1,015 B` gzip) | Carregado **apenas** ao visitar `/search` |
| **Vazamento de InstantSearch no chunk principal** | N/A | `false` (0 referências) | Verificado no bundle e na rede em `/` e PDP |
| **Requisições `suggest` digitando `"fone"` (4 chars)** | N/A | `1` requisição | Debounce ~200 ms + cancelamento `AbortSignal` |
| **Requisições PDP recommendations antes do scroll** | N/A | `0` requisições | `IntersectionObserver` (`rootMargin: 200px 0px`) |
| **Requisições PDP recommendations após entrar na viewport** | N/A | `1` requisição combinada | `types=related,upsell` (8 related, 0 upsell no seed `fone`) |
| **CLS na PDP ao carregar recomendações lazy** | `0.1236` (sem reserva) | **`0`** (`0.0000`) | Reserva `minHeight: 690px` + `.rec-skeleton-card { min-height: 600px }` |
| **Inline Add to Cart no cross-sell do Carrinho** | N/A | `MiniCart` permaneceu fechado (`true`) | `addToCart` + `closeCart`; item removido do bloco sem flash |

---

## 2. Isolamento de Bundle e Chunk Lazy (`React.lazy`)

Verificação realizada tanto estaticamente em `apps/storefront/dist/assets/` (build com `VITE_API_URL=http://localhost:3001`) quanto dinamicamente via rede no `vite preview` em Chromium headless:

1. **Inspeção estática de chunks (`vite build`):**
   - `index-B8ZU7Jdq.js`: `613,225 B` raw (`175,122 B` gzip) — `grep` por `react-instantsearch`, `algoliasearch-helper` ou `InstantSearch` retorna **0 ocorrências**.
   - `index-BVXtrhdg.css`: `72,255 B` raw (`12,057 B` gzip).
   - `SearchResultsPage-Dck5R8YI.js`: `189,186 B` raw (`52,238 B` gzip) — contém exclusivamente o chunk da rota `/search` (`react-instantsearch@7.55.1` + `instantsearch.js@4.123.1` + `algoliasearch-helper@3.30.3`).
   - `SearchResultsPage-CdVrgW9X.css`: `3,171 B` raw (`1,015 B` gzip).
2. **Prova de rede em `vite preview` (produção):**
   - Ao abrir `/`: carregou apenas `["index-BVXtrhdg.css", "index-B8ZU7Jdq.js"]` (`searchChunkAbsentOnCatalog: true`).
   - Ao navegar para PDP (`/audio/fone-de-ouvido-bluetooth-over-ear-pro`): `loadedAssetsOnPdp: []` (`searchChunkAbsentOnPdp: true`).
   - Ao navegar para `/search?q=fone`: carregou sob demanda `["SearchResultsPage-CdVrgW9X.css", "SearchResultsPage-Dck5R8YI.js"]` (`searchChunkLoadedOnSearch: true`).
   - O selo de telemetria DEV (`[data-testid="search-dev-badge"]`) teve **`0` elementos no DOM** no build de produção (`devBadgeHiddenInProdBuild: true`).

---

## 3. Verificação dos Três Modos de Busca (`hybrid`, `keyword`, `postgres`)

Com a pilha Docker completa (`minieshop-storefront-1`, `minieshop-api-1`, `minieshop-worker-1`, `minieshop-postgres-1`, `minieshop-search-1`, `minieshop-embeddings-1` com `embeddinggemma` nos 30 produtos publicados):

| Modo do Servidor | Condição de Infraestrutura Testada | Selo Exclusivo de DEV (`[data-testid="search-dev-badge"]`) | Comportamento da UI |
| :--- | :--- | :--- | :--- |
| **`hybrid`** | Meilisearch + Ollama `embeddinggemma` ativos (30/30 vetores) | `DEV • mode: hybrid • 3195 ms` (cold load do modelo) / `DEV • mode: hybrid • 22 ms` – `26 ms` (aquecido) | Grid de resultados normal (`24` cards em `q=fone`, sem layout horizontal estourado) |
| **`keyword`** | Container `embeddings` parado + consulta não cacheada (`q=teclado%20aluminio`) | `DEV • mode: keyword • 668 ms` (`632 ms` antes do `up-ai`) | Mesmo layout e cards, degradação invisível ao usuário final |
| **`postgres`** | Containers `embeddings` e `search` parados (`q=fone`) | `DEV • mode: postgres • 159 ms` | Degradação silenciosa para PostgreSQL FTS; exibe card correspondente (`1` card) sem erro |

---

## 4. Recomendações (`R05`), CLS e Cenários de Caos / Cache (`run-metrics.mjs`)

Resultados do `pnpm --filter @minieshop/storefront metrics -- --mode=after --url=http://localhost:5199 --runs=5`:

- **Cenário 1 — Carga inicial do catálogo (5 execuções, mediana):**
  - `medianTotalRequests`: `124` | `medianApiRequests`: `4` | `medianTimeToContentMs`: `447.1 ms` | `cardCount`: `12`.
- **Cenário 2 — Navegação Catálogo -> PDP -> Voltar (mediana):**
  - `medianApiRequestsOnBack`: `0` | `medianProductListRequestsOnBack`: `0` | `medianBackRenderMs`: `39.7 ms`.
- **Cenário 3 — Transição de filtros sem flash:**
  - `sawZeroCards`: `false` | `sawSkeleton`: `false` | `minCardsDuringTransition`: `11`.
- **Cenário 4 — Caos (800 ms delay) e substituição de busca fora de ordem em `/search`:**
  - `sawUpdatingIndicator`: `true` | `settledOnTeclado`: `true` | `topResult`: `"Teclado Mecânico RGB Switch Brown"` | `visibleCount`: `24`.
- **Cenário 5 — Caos (`503`) e Retry:**
  - `errorStateShown`: `true` | `recoveredOnRetry`: `true` | `recoveredCardCount`: `12`.
- **Cenário 6 — Favoritos otimistas + rollback:**
  - `updatedImmediatelyUnderLatency`: `true` (`uiFlipMs: 107.1 ms`) | `rolledBackOnFailure`: `true` | `alertVisible`: `true`.
- **Cenário 9 — Lazy PDP e Cross-Sell no Carrinho:**
  - Antes da correção de reserva de altura na PDP, o carregamento lazy de recomendações deslocava o `.app-footer` em **`CLS = 0.1236`** (`cardHeight ≈ 615.6 px` vs skeleton inicial de `420 px`).
  - Após ajustar `.rec-skeleton-card { min-height: 600px }` e reservar `minHeight: 690px` em `.pdp-recommendations` enquanto `!isSettled` (liberando quando a resposta vazia chega para colapsar silenciosamente), o CLS ao rolar até a seção e renderizar os 8 cards relacionados caiu para **`CLS = 0` (`0.0000`)**.
  - Na rota `/cart`, clicar no botão inline de adição no bloco `"Pair with your order"` / `"Combine com o seu pedido"` manteve o drawer do `MiniCart` fechado (`miniCartStayedClosedOnInlineAdd: true`) e incrementou o carrinho imediatamente (`cartItemsIncrementedInline: true`).

---

## 5. Acessibilidade (APG + `vitest-axe`) e Matriz Claro/Escuro × Responsivo

1. **Testes automatizados (`vitest` + `vitest-axe@0.1.0`):**
   - `18` arquivos de teste / `104` testes no storefront passando (`0` violações `vitest-axe` em `SearchBar` aberto/fechado, `SearchResultsPage`, `RecommendationCarousel`, `ProductDetailPage` com recomendações carregadas e `CartPage` com cross-sell).
   - `26` testes de contrato e integração unitária na API passando sem alterações no backend.
2. **Navegação por teclado ao vivo no Chromium (`http://localhost:5199`):**
   - Combobox em `/`: `ArrowDown` mantém foco DOM no `<input role="combobox">` (`inputHasDomFocus: true`), define `aria-expanded="true"`, atualiza `aria-activedescendant` para a primeira opção (`aria-selected="true"`) e anuncia na região `aria-live="polite"` (`"2 suggestions available"`).
   - `End` seleciona a última opção (`"See all results for «fone»"`).
   - `Escape` fecha a lista (`aria-expanded="false"`) mantendo o foco no input (`inputStillFocused: true`).
   - Carrossel horizontal: foco redirecionado entre Anterior/Próximo ao atingir os limites sem armadilha de foco; `scroll-behavior` respeita `prefers-reduced-motion: reduce`.
3. **Verificação manual com leitor de tela (macOS VoiceOver):**
   - Não executada interativamente via sessão GUI de VoiceOver neste ambiente CLI headless; validada por inspeção programática da árvore ARIA, regiões `aria-live="polite"`, auditoria `vitest-axe` em todos os estados e fluxo real de teclado em Chromium.
4. **Matriz Claro / Escuro e Desktop (`1280×800`) / Mobile (`375×812`):**
   - Light (`rgb(249, 250, 251)`) e Dark (`rgb(15, 16, 21)`) em Desktop e Mobile registraram **`0 px` de overflow horizontal** tanto em `/search?q=fone` quanto na PDP com carrossel carregado.
