# Métricas Antes e Depois — Integração Storefront ↔ API Real (Fase 6 / T26)

Relatório comparativo entre o SPA estático na tag **`pre-monorepo`** (dados em memória `src/data/products.ts` + imagens remotas Unsplash) e o storefront integrado à API real em **`feat/monorepo-integration`** (`apps/storefront` + `apps/api` + PostgreSQL + SeaweedFS + `@minieshop/contracts`).

---

## 1. Referência ao Baseline de Profiler (Gate 1)

O baseline de renderização do carrinho (Etapa 4, anterior à integração com a API) está registrado em [`docs/sdd/0001-dedicated-cart-and-checkout.md`](../sdd/0001-dedicated-cart-and-checkout.md) e [`docs/adr/0001-frontend-architecture-baseline.md`](../adr/0001-frontend-architecture-baseline.md), e permanece coberto pelo teste automatizado `apps/storefront/src/pages/CartPage/__tests__/CartPage.profiler.test.tsx`:

- **Monolítico Context + `useReducer` (antes da Etapa 4):** `70` updates no React `<Profiler>` nas 4 interações do carrinho.
- **Redux Toolkit + `createSelector` + `React.memo` (Etapa 4 e mantido na Fase 6):** `16` updates (**-77,1%**, `0` re-renders desperdiçados em irmãos). Todos os testes de imutabilidade, memoização e isolamento `<Profiler>` seguem passando após a adaptação mínima para UUID/slug/centavos/v2.

---

## 2. Metodologia e Ambiente

- **Data da coleta:** `2026-11-23`
- **Ambiente local:** macOS (`darwin-arm64`), OrbStack / Docker Compose v2, Node `26.13.0`, pnpm `12.21.0`, Turborepo `2.11.13`, Vite `8.3.8`, TanStack React Query `5.108.2`, Playwright `1.65.1` (Chromium Headless Shell `159.0.8154.6`).
- **Repetições:** mediana de **`5` execuções independentes** (cada repetição em `BrowserContext` limpo) para os cenários de carga inicial e navegação `Catálogo -> PDP -> Voltar`.
- **Comandos reproduzíveis:**
  ```bash
  # Depois (contra Docker Compose em desenvolvimento, com CHAOS_ENABLED=true na API)
  pnpm --filter @minieshop/storefront metrics -- \
    --mode=after --url=http://localhost:5199 --apiUrl=http://localhost:3001 \
    --runs=5 --distDir="$PWD/apps/storefront/dist"

  # Depois (comparação apples-to-apples do bundle de produção contra a API real)
  pnpm --filter @minieshop/storefront exec vite preview --host 127.0.0.1 --port 5199 --strictPort
  pnpm --filter @minieshop/storefront metrics -- \
    --mode=before --url=http://localhost:5199 --apiUrl=http://localhost:3001 \
    --runs=5 --distDir="$PWD/apps/storefront/dist"

  # Antes (build de produção da tag pre-monorepo via git archive temporário)
  mkdir -p /tmp/minieshop-pre-monorepo
  git archive pre-monorepo | tar -x -C /tmp/minieshop-pre-monorepo
  (cd /tmp/minieshop-pre-monorepo && npm ci && npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort)
  pnpm --filter @minieshop/storefront metrics -- \
    --mode=before --url=http://127.0.0.1:4173 \
    --runs=5 --distDir=/tmp/minieshop-pre-monorepo/dist
  ```

---

## 3. Tabelas Comparativas (Antes vs. Depois)

### 3.1 Cenários 1 a 6 — Comportamento em Navegador (Playwright, mediana de 5 repetições)

| # | Cenário / Métrica | Antes (`pre-monorepo`, build prod estático) | Depois (Build prod + API real Compose) | Depois (Compose Vite DEV + API real) | Observação |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **1** | **Carga inicial — Total de requisições** | `15` | `7` | `109` | No Compose DEV o Vite serve módulos ESM sem bundle; no build prod há 7 reqs (HTML/CSS/JS + 4 API). |
| **1** | **Carga inicial — Requisições HTTP à API** | `0` | `4` | `4` | `GET /categories`, `GET /products`, `GET /products/facets`, `GET /favorites`. |
| **1** | **Carga inicial — Bytes transferidos** | `701.201 B` (684,8 KiB) | `645.601 B` (630,5 KiB) | `10.069.073 B` (9,60 MiB) | Em prod, WebP local no SeaweedFS + bundle é menor que os 12 JPEGs remotos do Unsplash; em DEV há overhead de módulos sem minificação. |
| **1** | **Carga inicial — Tempo até 1º conteúdo (cards)** | `361,4 ms` | `177,7 ms` | `452,3 ms` | Antes tinha atraso artificial de `220 ms` no mock + rede externa; em prod contra API local ficou mais rápido (`177,7 ms`). |
| **2** | **Catálogo → PDP → Voltar — Reqs de API ao voltar** | `0` | **`0`** | **`0`** | **Comprovado:** dentro do `staleTime` (2 min), voltar ao catálogo dispara **`0` requisições** (`GET /products` = `0`). |
| **2** | **Catálogo → PDP → Voltar — Tempo de render ao voltar** | `12,5 ms` | `13,9 ms` | `37,1 ms` | Renderização imediata a partir do cache do TanStack Query. |
| **3** | **Troca de filtro — Tela vazia (`sawZeroCards`)** | `false` | `false` | `false` | `placeholderData: keepPreviousData` preserva os cards anteriores durante a transição (mesmo com `x-chaos-delay: 500`). |
| **3** | **Troca de filtro — Flash de skeleton (`sawSkeleton`)** | `false` | `false` | `false` | Nenhuma tela vazia ou skeleton intermediário; mínimo de `11` cards visíveis durante toda a transição. |
| **4** | **Latência alta (`x-chaos-delay: 800`) — Indicador de carregamento** | `n/a` | `n/a` *(caos só DEV)* | `true` | Pill `Updating results...` exibida enquanto a requisição atrasada está em voo. |
| **4** | **Latência alta (`x-chaos-delay: 800`) — Sem resultado antigo** | `n/a` | `n/a` *(caos só DEV)* | `true` (`1` card `teclado`) | Busca rápida `"teclado"` prevalece sobre busca anterior `"fone"` (cancelamento por query key + `AbortSignal`). |
| **5** | **Erro simulado (`x-chaos-fail: 1`) — Estado de erro + Retry** | `n/a` | `n/a` *(caos só DEV)* | `true` -> `12` cards recuperados | **Comprovado:** erro padronizado exibe botão "Try Again", que chama `refetch()` e recupera os 12 cards do catálogo. |
| **6** | **Favorito otimista sob latência (`800 ms`) — Flip imediato** | `n/a` | `n/a` *(caos só DEV)* | `true` (`301,9 ms` < `800 ms`) | `aria-pressed` alterna antes do retorno da API (muito abaixo dos `800 ms` de latência injetada). |
| **6** | **Favorito otimista com falha (`x-chaos-fail: 1`) — Rollback + alerta** | `n/a` | `n/a` *(caos só DEV)* | `true` (`alertVisible: true`) | Estado do coração reverte ao confirmado e exibe toast de erro `role="alert"`. |

### 3.2 Cenário 7 — Tamanho do Bundle de Produção (`vite build`)

| Artefato | Antes (`pre-monorepo`) | Depois (`feat/monorepo-integration`) | Variação |
| :--- | :---: | :---: | :---: |
| **JS principal (raw)** | `438.217 B` (427,9 KiB) | `561.400 B` (548,2 KiB) | **`+123.183 B` (+28,1% — piora)** |
| **JS principal (gzip)** | `132.616 B` (129,5 KiB) | `161.303 B` (157,5 KiB) | **`+28.687 B` (+21,6% — piora)** |
| **CSS (raw)** | `65.968 B` (64,4 KiB) | `66.686 B` (65,1 KiB) | `+718 B` (+1,1%) |
| **CSS (gzip)** | `10.996 B` (10,7 KiB) | `11.144 B` (10,9 KiB) | `+148 B` (+1,3%) |
| **Total assets (raw)** | `504.185 B` (492,4 KiB) | `628.086 B` (613,4 KiB) | **`+123.901 B` (+24,6% — piora)** |
| **Total assets (gzip)** | `143.612 B` (140,2 KiB) | `172.447 B` (168,4 KiB) | **`+28.835 B` (+20,1% — piora)** |
| **Dados estáticos (`products.ts`) no bundle** | Presentes (~15 KiB) | **`0` ocorrências** *(verificado por grep)* | Removidos 100% |
| **Código de caos (`x-chaos-*` / `chaos.*`) no bundle** | `n/a` | **`0` ocorrências** *(verificado por grep)* | Eliminado 100% por tree-shaking |

---

## 4. Verificações Complementares ao Vivo (T24 e T25)

- **Fallback sem imagem no seed (`T24`):** `/home-office/organizador-de-mesa-em-madeira-aluminio` renderizou `0` elementos `<img>`, `1` fallback SVG inline `.product-image__fallback` e **`0` requisições** ao SeaweedFS (`:8333`).
- **Fallback com storage fora do ar (`T24`):** após `docker compose stop storage`, todos os **`12/12` cards** do catálogo transitaram via estado React (`onError`) para o fallback SVG inline (`remainingImgs: 0`), sem laço de erro e mantendo o `aspect-ratio` reservado.
- **Paridade de facetas (`T25`):** no seed real, a opção `Bluetooth` exibiu contagem `4` na faceta e, ao ser aplicada (`?attr.connectivity=Bluetooth`), renderizou exatamente **`4` cards**.

---

## 5. Conclusão Honesta

1. **Ganhos comprovados:**
   - A integração com a API real manteve **`0` requisições de rede ao voltar da PDP dentro do `staleTime`** (`13,9 ms` em build prod), **`0` flashes/skeletons na troca de filtros** (`keepPreviousData`), recuperação completa via **"Try Again"** sob `x-chaos-fail=1`, atualização otimista com rollback em favoritos e remoção total dos dados estáticos (`products.ts`) e do código de caos do bundle de produção.
   - Em build de produção contra a API local, o tempo até renderização dos cards caiu de `361,4 ms` para `177,7 ms` (o mock anterior simulava `220 ms` de latência fixa e baixava 12 fotos do Unsplash).
2. **Pioras e trade-offs explícitos:**
   - **Crescimento real do bundle JS:** mesmo removendo `products.ts` (~15 KiB), o JS cresceu **`+123,2 kB` raw (`+28,7 kB` gzip, +21,6%)** devido à inclusão do `zod@3.24.2` e dos schemas tolerantes de `@minieshop/contracts/catalog/client`, além de `HttpClient`, `CatalogFilters`, `ProductImage` e utilitários de URL. O chunk principal ultrapassou `500 kB` raw (`561,4 kB`), sinalizando que *code-splitting* por rota (`React.lazy` em `ProductDetailPage` e `CartPage`) será uma otimização natural em fase futura.
   - **Requisições iniciais à API:** o app passou de `0` para `4` requisições de API na carga inicial (`/categories`, `/products`, `/products/facets`, `/favorites`).
   - **Ambiente DEV no Compose:** o servidor Vite em modo desenvolvimento gera `109` requisições ESM (~`10,07 MB` sem minificação) e `452,3 ms` até o conteúdo — comportamento esperado de dev server, contrastando com as `7` requisições (`645,6 kB`, `177,7 ms`) do build de produção.

---

## 6. Limitações

- **Catálogo pequeno:** apenas `30` produtos e `21` categorias no seed; tempos de consulta SQL/facetas e payload JSON não representam catálogos de milhares de SKUs.
- **Execução em máquina local (loopback / OrbStack):** RTT próximo de `0 ms` sem perda de pacotes nem throttling de rede/CPU (exceto onde `x-chaos-delay` foi injetado explicitamente).
- **Sem CDN ou HTTP/2 real na frente do SeaweedFS:** imagens servidas diretamente de `localhost:8333`.
- **Cache frio por repetição:** cada uma das 5 repetições abriu um `BrowserContext` novo, sem aquecimento prévio de cache de disco do navegador (HTTP `ETag`/`304`).
