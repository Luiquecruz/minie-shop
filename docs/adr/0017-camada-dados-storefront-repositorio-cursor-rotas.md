# ADR-0017: Camada de Dados do Storefront, Parse Tolerante, Paginação por Cursor e Rotas Canônicas

- **Status:** Accepted
- **Date:** 2026-11-23
- **Phase:** Fase 6 — Integração Storefront ↔ API (`T22`, `T23`, `T25`)

## Contexto

Com a unificação do monorepo (`ADR-0016`), o storefront (`apps/storefront`) deixa de consumir a fonte estática `src/data/products.ts` e passa a se comunicar com a API HTTP real (`apps/api`) para categorias, catálogo paginado por cursor, facetas disjuntivas, detalhe do produto (PDP) e favoritos anônimos por cookie `anon_id`.

Precisamos definir uma camada de dados no frontend que:
- mantenha os componentes e hooks React desacoplados de `fetch` e URLs concretas, permitindo testes determinísticos e modo offline via implementação mock;
- consuma os contratos compartilhados de `@minieshop/contracts` sem quebrar a UI quando a API evoluir de forma aditiva (novos campos opcionais);
- adapte a UX de paginação numerada para a paginação por **cursor** da API sem perda de contexto visual;
- estabeleça rotas canônicas preparadas para SEO/JSON-LD, política monetária estrita em centavos inteiros (sem cálculo de câmbio no cliente) e base inicial de i18n.

## Decisão

### 1. Padrão Repositório e Injeção de Dependência
- Definir a porta `ProductRepository` em `apps/storefront/src/domain/repositories/ProductRepository.ts` usando exclusivamente os DTOs de `@minieshop/contracts`.
- Implementar duas versões cumprindo o mesmo contrato (validado por suíte compartilhada):
  - `HttpProductRepository`: chama a API via `HttpClient`.
  - `MockProductRepository`: opera em memória sobre fixtures em `src/test/fixtures/catalogFixture.ts` (sem depender de rede).
- Injetar a implementação via `ProductRepositoryProvider` (`React.Context`) e hook `useProductRepository()`.

### 2. Cliente HTTP Único, Erros Tipados e Parse Tolerante
- `HttpClient` (`src/infrastructure/http/httpClient.ts`) valida `VITE_API_URL` com Zod no boot (`src/config/env.ts`), envia `credentials: 'include'` em todas as chamadas, combina `AbortSignal` externo com timeout explícito e traduz falhas em três classes distintas:
  - `ApiError` (`status`, `code`, `message`, `requestId`, `details?`) para o envelope padronizado da API (`{ error: { ... } }`);
  - `NetworkError` (`isTimeout`) para indisponibilidade de rede ou timeout;
  - `ContractViolationError` para violação de contrato Zod (loga detalhes estruturados e expõe estado de erro recuperável na UI, sem derrubar a árvore React).
- **Parse tolerante no cliente (`@minieshop/contracts/catalog/client`):** enquanto os schemas de saída do servidor permanecem `.strict()` para impedir vazamento de colunas internas (`ADR-0008`), o cliente valida toda resposta com variantes `.strip()` exportadas em `@minieshop/contracts/catalog/client` (tipadas contra os mesmos DTOs via `z.ZodType<DTO>`). Campos aditivos futuros são descartados silenciosamente; quebras estruturais geram `ContractViolationError`.
- **Cabeçalhos de caos exclusivamente em DEV:** `x-chaos-delay`, `x-chaos-fail` e `x-chaos-status` são lidos de `localStorage` (`chaos.delay`, `chaos.fail`, `chaos.status`) estritamente sob `if (import.meta.env.DEV)`, garantindo eliminação completa por tree-shaking no build de produção.

### 3. Paginação por Cursor (`useInfiniteQuery`) e Cache React Query
- A API do catálogo usa paginação keyset por cursor (`nextCursor`). O storefront substitui a paginação numerada (`Pagination`) por `useInfiniteQuery` com botão acessível **"Load more"** (`hasNextPage` / `fetchNextPage` / `isFetchingNextPage`), preservando a posição do usuário e mantendo `placeholderData: keepPreviousData` nas trocas de filtro para evitar flash de skeleton.
- `staleTime` explícito por tipo de dado: categorias (`5 min`), listagem/facetas/PDP (`2 min`), favoritos (`1 min`).
- Política de retry: **sem retry em erros `4xx` (`ApiError.isClientError`) nem em `ContractViolationError`**; até 2 tentativas com backoff exponencial em erros `5xx` ou `NetworkError`.

### 4. Rotas Canônicas da PDP (`/:category/:slug`) e Compatibilidade
- Adotar `/:category/:slug` como rota canônica da PDP (ex.: `/audio/fone-de-ouvido-bluetooth-over-ear-pro`), alinhada a padrões de SEO, dados estruturados (`JSON-LD`) e Google Merchant Center.
- Caso `:category` na URL divirja de `product.category.slug`, a PDP redireciona canonicamente com `replace` para `/${product.category.slug}/${product.slug}`.
- Manter `/product/:id` como rota de redirecionamento legado (`<Navigate replace />`) usando um mapa enxuto de 30 pares `id -> { categorySlug, slug }` (sem dados de produto no bundle).
- Qualquer produto inexistente (`404 NOT_FOUND`) ou rota desconhecida (`*`) renderiza uma página 404 dedicada.

### 5. Dinheiro em Centavos Inteiros, Multi-Moeda (Fase 6.1) e Base de i18n
- **Regra monetária:** todo valor monetário na lógica do storefront (catálogo, PDP, carrinho, frete e cupons) é um **inteiro em centavos** (`MoneyDTO` / `number` inteiro), formatado apenas na borda da UI por `formatMoney({ amount, currency })` com `Intl.NumberFormat('pt-BR')`.
- **Zero conversão de moeda no cliente:** o frontend não calcula taxas de câmbio. O seletor multi-moeda (`BRL/USD/EUR`) fica temporariamente oculto na `Navbar` até a **Fase extraordinária 6.1**, quando o backend introduzirá precificação multi-moeda explícita por produto com fallback de rate exclusivamente no servidor.
- **Camada leve de i18n (`src/i18n/`):** adotar um tradutor leve com inglês (`en`) como idioma base nesta fase (preservando os testes congelados do carrinho e centralizando as strings da UI) e deixando a estrutura pronta para internacionalização completa + seletor global de idioma na Fase 6.1.
- **Migração versionada do carrinho (congelado):** o `localStorage` do carrinho (`minieshop_cart`) passa a usar envelope `{ version: 2, items }` com snapshot de produto baseado em UUID, `slug`, `categorySlug`, `price: MoneyDTO` (centavos) e `image: ImageDTO | null`; estados legados v1 (IDs numéricos / preços float) são descartados com segurança na hidratação.

## Alternativas Consideradas

- **Chamar `fetch` diretamente nos hooks React Query:** descartado por acoplar testes de componente a rede/mock global de `fetch` e dificultar troca de transporte ou modo offline.
- **Usar os schemas `.strict()` do servidor direto no cliente:** descartado porque qualquer campo novo retornado pela API quebraria versões já carregadas do SPA em produção.
- **Manter paginação numerada emulando páginas no cliente:** descartado por incompatibilidade direta com keyset cursor da API e risco de duplicatas/lacunas entre páginas.
- **Manter conversão de moeda no frontend com taxas hardcoded:** descartado por gerar divergência financeira entre preço exibido e preço cobrado no backend/checkout.

## Consequências

### Positivas
- Contratos compartilhados em tempo de compilação e validação segura em runtime contra evoluções aditivas da API.
- Zero dados estáticos de catálogo e zero código de caos no bundle de produção.
- URL da PLP (`useSearchParams` + Zod) e da PDP (`/:category/:slug`) totalmente compartilháveis e preparadas para SEO.
- Testes de contrato provam que `MockProductRepository` e `HttpProductRepository` obedecem à mesma interface.

### Negativas / Trade-offs
- A troca de paginação numerada para "Load more" (cursor) remove o salto direto para uma página arbitrária N, o que é padrão de mercado para keyset pagination.
- O antigo chip "Favorites" da barra de categorias da PLP foi removido pois `GET /products` não possui filtro `favoritesOnly` (favoritos seguem funcionais via `GET/POST/DELETE /favorites` nos cards e PDP).
- O seletor multi-moeda na `Navbar` fica adiado para a Fase extraordinária 6.1 (precificação multi-moeda no backend).
