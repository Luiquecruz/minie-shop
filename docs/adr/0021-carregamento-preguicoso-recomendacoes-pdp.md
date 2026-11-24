# ADR-0021: Carregamento Preguiçoso dos Blocos de Recomendação na PDP

- **Status:** Accepted
- **Date:** 2026-11-24
- **Phase:** Fase 7 — Recomendações (`R05.2`, `R05.4`)

## Contexto

A PDP (`/:category/:slug`) exibe dois blocos de recomendação abaixo da ficha principal do produto: **relacionados** (`related`) e **upsell** (`upsell`), servidos em uma única chamada a `GET /products/:slug/recommendations?types=related,upsell`.

Usuários que abrem a PDP para conferir preço, fotos ou clicar diretamente em "Comprar agora" na barra flutuante muitas vezes não rolam até o final da página. Disparar a requisição de recomendações no mount inicial desperdiçaria chamadas de API e renderização para quem não chega até os blocos.

## Decisão

1. **Gatilho por Visibilidade (`IntersectionObserver` + `enabled`):**
   - Criar o hook reutilizável `src/hooks/useInView.ts` usando `IntersectionObserver` com `rootMargin: '200px 0px'` e estado *latched* (`hasIntersected` passa a `true` na primeira interseção e desconecta o observador).
   - O container `<PdpRecommendationsSection />` na PDP só habilita `useProductRecommendationsQuery({ slug, types: ['related', 'upsell'], enabled: hasIntersected })` quando `hasIntersected === true`, garantindo **0 requisições** antes da aproximação da viewport e **exatamente 1 requisição** combinada ao entrar na margem de visualização.
   - Em ambientes sem `IntersectionObserver` (ex.: navegadores muito antigos), o fallback seguro habilita a carga normalmente; nos testes Vitest (`jsdom`), um stub determinístico em `src/test/setup.ts` permite simular visibilidade de forma explícita.
2. **Prevenção de Salto de Layout (CLS) e Degradação Silenciosa:**
   - Enquanto a consulta está carregando (`isLoading` sem dados em cache), o `<RecommendationCarousel>` reserva `min-height` compatível com a altura de uma linha de cards + cabeçalho.
   - Quando as listas retornam vazias (`[]`) ou ocorre falha de rede/5xx (`isError`), o bloco **não é renderizado** e não deixa espaço vazio na página (registrando apenas `console.warn` e um selo discreto exclusivamente em `import.meta.env.DEV`), pois recomendações são secundárias e nunca podem quebrar a PDP ou o Carrinho.

## Alternativas Consideradas

- **Buscar recomendações imediatamente no mount da PDP:** descartado por gerar requisições e processamento desnecessários para visitantes que não rolam até os blocos.
- **Usar `scroll` listener global na `window`:** descartado por pior eficiência na thread principal e maior complexidade de limpeza em comparação ao `IntersectionObserver` nativo.

## Consequências

### Positivas
- Reduz requisições HTTP desnecessárias no carregamento inicial da PDP.
- `rootMargin: '200px 0px'` inicia o fetch um pouco antes da entrada visual do usuário, reduzindo a percepção de espera.
- Zero impacto na disponibilidade da PDP em falhas parciais da API de recomendações.

### Negativas / Trade-offs
- Em testes `jsdom`, é necessário controlar ou simular `IntersectionObserver` explicitamente para testar o comportamento pós-rolagem.
- Se um produto sem relações entrar na margem de `200px` ainda fora da tela visível e houver skeleton apenas após a interseção, o colapso para `null` acontece fora da dobra sem causar salto visível acima da dobra; caso o bloco já esteja dentro da viewport em telas muito altas, a transição de skeleton para vazio pode ocorrer abaixo do conteúdo principal.

## Notas de Evolução Incremental
- Caso o storefront adote SSR/Streaming ou `prefetch` no hover em fases futuras, o hook `useProductRecommendationsQuery` já isola a chave e o `staleTime` de 5 minutos em React Query, podendo ser pré-aquecido sem alterar os componentes de carrossel.
