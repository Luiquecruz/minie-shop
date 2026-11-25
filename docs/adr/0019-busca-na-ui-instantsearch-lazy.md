# ADR-0019: Busca na UI — React InstantSearch Restrito à Rota Preguiçosa `/search` vs `useInfiniteQuery`

- **Status:** Accepted
- **Date:** 2026-11-24
- **Phase:** Fase 7 — Busca (`S08.3`)

## Contexto

A Fase 7 introduz duas superfícies de busca no storefront (`apps/storefront`):
1. **Autocomplete global no cabeçalho (`S08.2`):** presente em todas as páginas (incluindo `/search`, onde sincroniza o termo com `?q=`), consumindo `GET /search/suggest` (máx. 8 sugestões lexicais rápidas).
2. **Página dedicada de resultados (`/search`, `S08.3`):** consumindo `GET /search` (`mode`: `hybrid`, `keyword`, `postgres`, `limit=24`, `offset <= 200`), sincronizada com `?q=` na URL, paginação incremental ("Carregar mais") e proteção rigorosa contra respostas fora de ordem.

Precisamos decidir:
- onde utilizar `react-instantsearch` (`7.55.1`, apoiado em `instantsearch.js@4.123.1`) e onde **não** utilizá-lo;
- como adaptar o endpoint público `GET /search` (sem falar direto com o Meilisearch, conforme `docs/api.md`) ao contrato oficial de `SearchClient` do InstantSearch;
- como evitar que o custo de bundle do ecossistema InstantSearch penalize o carregamento inicial do catálogo (`/`) e da PDP (`/:category/:slug`).

## Decisão

### 1. Fronteira Estrita de Uso e Code Splitting (`React.lazy`)
- **`react-instantsearch@7.55.1` fica restrito exclusivamente à rota `/search` (`SearchResultsPage`)**, carregada sob demanda via `React.lazy(() => import('./pages/SearchResultsPage/SearchResultsPage'))` com `<Suspense>` e fallback acessível.
- A página utiliza estritamente os hooks `useSearchBox`, `useInfiniteHits`, `useInstantSearch({ catchError: true })` e `useConfigure({ hitsPerPage: 24 })` dentro de `<InstantSearch future={{ preserveSharedStateOnUnmount: true }}>`.
- **Onde NÃO usar InstantSearch:** o autocomplete do cabeçalho (`SearchBar`) **não** usa InstantSearch; utiliza um hook próprio WAI-ARIA APG (`ADR-0020`) com TanStack React Query (`useSearchSuggestQuery`), evitando puxar o runtime do InstantSearch para o chunk principal (`index-*.js`) carregado no catálogo e na PDP.

### 2. Contrato Real do `SearchClient` Adaptado ao `ProductRepository`
De acordo com as definições TypeScript verificadas em `react-instantsearch@7.55.1` / `instantsearch.js@4.123.1` (`algoliasearch-helper/types/algoliasearch.d.ts`), `<InstantSearch searchClient={...}>` exige:
- `search(requests: Array<{ indexName: string; params: SearchOptions }>): Promise<{ results: SearchResponse<THit>[] }>`
- `searchForFacetValues(...)` (no-op retornando `{ facetHits: [], exhaustiveFacetsCount: true }` nesta fase, pois facetas na busca estão fora de escopo).

O adaptador (`src/infrastructure/search/instantSearchAdapter.ts`) implementa o mapeamento:
- **Consulta vazia (`query.trim().length === 0`):** curto-circuita imediatamente retornando `{ hits: [], nbHits: 0, page: 0, nbPages: 0, hitsPerPage, query: '' }` **sem chamar a API**.
- **Paginação:** `limit = params.hitsPerPage ?? 24` e `offset = (params.page ?? 0) * limit`. Se `offset > 200` (teto da API em `docs/api.md`), evita disparar requisição inválida (`400`) e devolve resultado vazio.
- **Transporte único:** delega para `ProductRepository.searchProducts(...)` (que usa o `HttpClient` único com `credentials`, timeout, `AbortSignal`, parse tolerante e cabeçalhos de caos em DEV — nunca `fetch` direto).
- **Hits e metadados:** mapeia cada `ProductCardDTO` para `{ ...card, objectID: card.id }`, preenche `nbHits: response.estimatedTotal` (ciente de que é estimativa do motor), `page`, `nbPages: Math.ceil(response.estimatedTotal / limit)`, `hitsPerPage`, `query`, `processingTimeMS` e `userData: [{ mode: response.mode, durationMs }]` para o selo exclusivo de DEV.
- **Erros e fora de ordem:** erros do repositório propagam para o ciclo de vida do InstantSearch e ficam disponíveis via `useInstantSearch({ catchError: true })` (`status === 'error'`, `error`, `refresh()`). Respostas fora de ordem são descartadas pelo contador interno de requisições do `algoliasearch-helper`.

### 3. Custo de Bundle Medido
- **Baseline pré-Fase 7 (`main` `a9eb8f2`, `vite build`):**
  - Chunk principal JS (`index-*.js`): **`589,48 kB` raw (`169,91 kB` gzip)** (`589,476 B`)
  - CSS principal (`index-*.css`): **`68,72 kB` raw (`11,48 kB` gzip)** (`68,716 B`)
- **Pós-Fase 7 (`feat/search-recs-ui`, `VITE_API_URL=http://localhost:3001 vite build`):**
  - Chunk principal JS (`index-B8ZU7Jdq.js`): **`613,22 kB` raw (`175,122 B` gzip zlib)** (`613,225 B` — **`+23,75 kB` raw**, **`0` ocorrências de `react-instantsearch` / `algoliasearch-helper`**)
  - CSS principal (`index-BVXtrhdg.css`): **`72,26 kB` raw (`12,057 B` gzip)** (`72,255 B`)
  - Chunk lazy exclusivo de `/search` (`SearchResultsPage-Dck5R8YI.js` + `SearchResultsPage-CdVrgW9X.css`): **`189,19 kB` JS (`52,238 B` gzip) + `3,17 kB` CSS (`1,015 B` gzip)** (`192,357 B` total), carregado **somente** ao navegar para `/search` conforme verificado em rede via `vite preview` (ver `docs/metrics/search-and-recommendations-ui.md`).
- **Dependência instalada:** `react-instantsearch@7.55.1` + `instantsearch.js@4.123.1` + `react-instantsearch-core@7.55.1`.

## Alternativas Consideradas

- **Usar `useInfiniteQuery` (TanStack Query) também na página `/search`:**
  - *Prós:* reutilizaria 100% da infraestrutura já existente sem adicionar `react-instantsearch` ao `package.json`, com menor bundle na rota `/search`.
  - *Contras (o que se perde):* perde-se o modelo declarativo de busca ao vivo (`InstantSearch` + `UiState` + `algoliasearch-helper`), descarte automático de respostas atrasadas fora de ordem via `lastQueryIdReceived`, gerenciamento unificado de páginas acumuladas via `useInfiniteHits`, e a base pronta caso futuras fases habilitem facetas/refinamentos (`useRefinementList`, `useRange`, `useSortBy`) sobre o índice de busca.
  - *Gatilho de reversão documentado:* caso o adaptador ou incompatibilidades de build/bundle se mostrem desproporcionais durante a implementação, a troca para `useInfiniteQuery` permanece explicitamente documentada como fallback válido mediante atualização deste ADR.
- **Carregar `react-instantsearch` de forma síncrona no bundle principal ou no autocomplete do cabeçalho:** descartado porque inflaria o chunk inicial de `/` e da PDP sem necessidade.

## Consequências

### Positivas
- Catálogo (`/`) e PDP (`/:category/:slug`) não pagam nenhum custo de download/parse do InstantSearch.
- A página `/search` ganha o ecossistema padrão de hooks do InstantSearch (`useSearchBox`, `useInfiniteHits`, `useInstantSearch`) desacoplado do transporte HTTP via `ProductRepository`.
- Contratos e tratamento de erros (`ApiError`, `NetworkError`, `ContractViolationError`) continuam centralizados no `HttpClient`.

### Negativas / Trade-offs
- Introdução de uma dependência externa (`react-instantsearch@7.55.1`) apenas para a rota `/search`, adicionando um chunk assíncrono na primeira visita à página de busca.
- Necessidade de sincronização bidirecional explícita entre `?q=` do React Router (`useSearchParams`) e o `uiState` do `InstantSearch` para suportar links compartilháveis e botões Voltar/Avançar do navegador.

## Notas de Evolução Incremental
- Caso facetas/filtros na busca ou destaque (`Highlight`) entrem em fase futura, o `<InstantSearch>` já estará pronto para plugar `useRefinementList` / `useSortBy` estendendo o `searchClient`. Se o custo do chunk lazy se revelar injustificável frente ao ganho prático, reverter para `useInfiniteQuery` registrando novo ADR que substitua este.
