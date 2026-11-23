# Qualidade e Cobertura das Recomendações (`R06`)

> **Aviso importante:** este documento apresenta **métricas automatizadas de cobertura** e uma **amostra de 10 produtos para revisão humana**. A qualidade percebida das recomendações **não está validada automaticamente** — a validação final e os ajustes de curadoria/limiar cabem à revisão humana.

---

## 1. Ambiente e Parâmetros da Coleta

- **Data:** 2026-11-22
- **Catálogo:** 30 produtos publicados (seed), 21 categorias (5 raízes + 16 subcategorias), 51 regras em `recommendations.category_complements`, 3 relações manuais em `apps/api/seed/manual-relations.json`.
- **Modelo de embeddings:** `embeddinggemma` (`768` dimensões, `pgvector 0.8.7`, `hnsw.iterative_scan = 'relaxed_order'`).
- **Parâmetros ativos (`ADR-0013` / spec `ADR-007`):**
  - `RECOMMENDATIONS_RELATED_MIN_SIMILARITY = 0.45`
  - `RECOMMENDATIONS_UPSELL_MIN_SIMILARITY = 0.50`
  - `RECOMMENDATIONS_UPSELL_MIN_RATIO = 1.10`
  - `RECOMMENDATIONS_UPSELL_MAX_RATIO = 2.50`
  - `RECOMMENDATIONS_CROSS_SELL_MAX_PER_CATEGORY = 2`

---

## 2. Métricas de Cobertura (`pnpm relations:status`)

### 2.1 Modo Vetorial (profile `ai` ativo — 30/30 embeddings)

| Tipo | Total de Relações | Manual | Auto (`vector`) | Auto (`rule`) | Produtos >= 1 | Produtos >= 3 | Produtos >= 5 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `related` | 292 | 0 | 292 | 0 | 30 (**100.0%**) | 29 (**96.7%**) | 28 (**93.3%**) |
| `upsell` | 10 | 1 | 9 | 0 | 9 (**30.0%**) | 0 (**0.0%**) | 0 (**0.0%**) |
| `cross_sell` | 211 | 2 | 209 | 0 | 30 (**100.0%**) | 30 (**100.0%**) | 30 (**100.0%**) |
| **Total por método** | **513** | **3** | **510** | **0** | — | — | — |

> **Nota sobre `upsell` (30.0% >= 1):** por decisão de arquitetura (`ADR-0013`), `upsell` restringe-se à **mesma categoria folha** na faixa `1.10x–2.50x` com similaridade >= `0.50`. Em um catálogo pequeno de 30 itens com 16 subcategorias (várias com 1–2 produtos), apenas 9 produtos não são o item mais caro (ou único) da própria subcategoria e possuem candidato elegível nessa faixa.

### 2.2 Modo Fallback por Regra (profile `ai` desligado — `make -C infra reset`)

Coletado após `make -C infra reset` (sem Ollama / sem embeddings):

| Tipo | Total de Relações | Manual | Auto (`vector`) | Auto (`rule`) | Produtos >= 1 | Produtos >= 3 | Produtos >= 5 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `related` | 204 | 0 | 0 | 204 | 30 (**100.0%**) | 25 (**83.3%**) | 25 (**83.3%**) |
| `upsell` | 12 | 1 | 0 | 11 | 11 (**36.7%**) | 0 (**0.0%**) | 0 (**0.0%**) |
| `cross_sell` | 214 | 2 | 0 | 212 | 30 (**100.0%**) | 30 (**100.0%**) | 30 (**100.0%**) |
| **Total por método** | **430** | **3** | **0** | **427** | — | — | — |

*(Observação: no modo regra sem filtro de similaridade, `upsell` passa de 9 para 11 produtos porque `mouse -> teclado` (1.81x) e `carteira -> garrafa-termica` (1.10x) entram pela faixa de preço.)*

---

## 3. Amostra para Revisão Humana (10 Produtos — Modo Vetorial)

Amostra cobrindo as 5 categorias raiz do seed (`eletronicos`, `acessorios`, `casa-e-decoracao`, `vestuario`, `calcados`), exibindo até 5 `related`, 4 `upsell` e 4 `cross_sell` na ordem exata entregue pela API (`manual` primeiro por `position`, depois `auto` por `score DESC`).

### 1. `fone-de-ouvido-bluetooth-over-ear-pro` (`audio`, R\$ 349,90)
- **`related`:** `earbuds-tws-cancelamento-de-ruido` (0.7250), `caixa-de-som-portatil-bluetooth-waterproof` (0.6796), `oculos-de-realidade-virtual-imersivo` (0.5525), `smartwatch-fitness-active-series` (0.5488), `mouse-optico-ergonomico-sem-fio` (0.5116)
- **`upsell`:** *(vazio — já é o item mais caro de `audio`)*
- **`cross_sell`:** **`mochila-urbana-impermeavel-antifurto` (`manual`, pos 0)**, `oculos-de-realidade-virtual-imersivo` (0.5525), `smartwatch-fitness-active-series` (0.5488), `oculos-de-grau-bloqueio-luz-azul` (0.5086)

### 2. `earbuds-tws-cancelamento-de-ruido` (`audio`, R\$ 279,00)
- **`related`:** `fone-de-ouvido-bluetooth-over-ear-pro` (0.7250), `caixa-de-som-portatil-bluetooth-waterproof` (0.6270), `oculos-de-realidade-virtual-imersivo` (0.5566), `carregador-sem-fio-fast-charge-15w` (0.5408), `smartwatch-fitness-active-series` (0.5022)
- **`upsell`:** **`fone-de-ouvido-bluetooth-over-ear-pro` (`manual`, pos 0)**
- **`cross_sell`:** `oculos-de-realidade-virtual-imersivo` (0.5566), `carregador-sem-fio-fast-charge-15w` (0.5408), `smartwatch-fitness-active-series` (0.5022), `oculos-de-grau-bloqueio-luz-azul` (0.4903)

### 3. `mouse-optico-ergonomico-sem-fio` (`perifericos`, R\$ 159,90)
- **`related`:** `oculos-de-realidade-virtual-imersivo` (0.5669), `cadeira-de-escritorio-ergonomica-mesh` (0.5465), `carregador-sem-fio-fast-charge-15w` (0.5185), `fone-de-ouvido-bluetooth-over-ear-pro` (0.5116), `earbuds-tws-cancelamento-de-ruido` (0.4802)
- **`upsell`:** *(vazio — `teclado-mecanico-rgb-switch-brown` teve sim 0.4472 < 0.50)*
- **`cross_sell`:** `cadeira-de-escritorio-ergonomica-mesh` (0.5465), `suporte-articulado-para-notebook-aluminio` (0.4780), `luminaria-de-mesa-articulada-nordica` (0.4523), `oculos-de-grau-bloqueio-luz-azul` (0.4502)

### 4. `drone-compacto-dobravel-4k-hdr` (`foto-video-e-drones`, R\$ 1.899,00)
- **`related`:** `camera-mirrorless-4k-creator-kit` (0.6581), `caixa-de-som-portatil-bluetooth-waterproof` (0.5181), `fone-de-ouvido-bluetooth-over-ear-pro` (0.5003), `oculos-de-realidade-virtual-imersivo` (0.4752), `tablet-10-5-polegadas-retina-display` (0.4607)
- **`upsell`:** `camera-mirrorless-4k-creator-kit` (0.6581, 1.74x)
- **`cross_sell`:** `tablet-10-5-polegadas-retina-display` (0.4607), `carregador-sem-fio-fast-charge-15w` (0.4586), `oculos-de-sol-polarizado-classic-aviator` (0.4320), `bolsa-mala-de-viagem-duffle-weekend` (0.4299)

### 5. `mochila-urbana-impermeavel-antifurto` (`bolsas-e-mochilas`, R\$ 189,90)
- **`related`:** `bolsa-mala-de-viagem-duffle-weekend` (0.6141), `carregador-sem-fio-fast-charge-15w` (0.5751), `caixa-de-som-portatil-bluetooth-waterproof` (0.5619), `suporte-articulado-para-notebook-aluminio` (0.5368), `tenis-running-ultralight-performance` (0.5233)
- **`upsell`:** `bolsa-mala-de-viagem-duffle-weekend` (0.6141, 1.32x)
- **`cross_sell`:** `carregador-sem-fio-fast-charge-15w` (0.5751), `caixa-de-som-portatil-bluetooth-waterproof` (0.5619), `carteira-slim-em-couro-legitimo` (0.5157), `fone-de-ouvido-bluetooth-over-ear-pro` (0.4744)

### 6. `oculos-de-grau-bloqueio-luz-azul` (`oculos-e-relogios`, R\$ 119,00)
- **`related`:** `oculos-de-sol-polarizado-classic-aviator` (0.6232), `oculos-de-realidade-virtual-imersivo` (0.5424), `fone-de-ouvido-bluetooth-over-ear-pro` (0.5086), `earbuds-tws-cancelamento-de-ruido` (0.4903), `smartwatch-fitness-active-series` (0.4774)
- **`upsell`:** `oculos-de-sol-polarizado-classic-aviator` (0.6232, 1.18x)
- **`cross_sell`:** `oculos-de-realidade-virtual-imersivo` (0.5424), `fone-de-ouvido-bluetooth-over-ear-pro` (0.5086), `carteira-slim-em-couro-legitimo` (0.4258), `mochila-urbana-impermeavel-antifurto` (0.4232)

### 7. `cafeteira-prensa-francesa-inox-600ml` (`cozinha-e-cafe`, R\$ 119,90)
- **`related`:** `garrafa-termica-inox-vacuum-750ml` (0.6260), `kit-xicaras-de-ceramica-artesanal-2-un` (0.6061), `luminaria-de-mesa-articulada-nordica` (0.4946), `cadeira-de-escritorio-ergonomica-mesh` (0.4871), `suporte-articulado-para-notebook-aluminio` (0.4783)
- **`upsell`:** *(vazio — já é o item mais caro de `cozinha-e-cafe`)*
- **`cross_sell`:** **`kit-xicaras-de-ceramica-artesanal-2-un` (`manual`, pos 0)**, `garrafa-termica-inox-vacuum-750ml` (0.6260), `suporte-articulado-para-notebook-aluminio` (0.4783), `oculos-de-sol-polarizado-classic-aviator` (0.4546)

### 8. `organizador-de-mesa-em-madeira-aluminio` (`home-office`, R\$ 85,00)
- **`related`:** `suporte-articulado-para-notebook-aluminio` (0.6838), `luminaria-de-mesa-articulada-nordica` (0.6772), `cadeira-de-escritorio-ergonomica-mesh` (0.6008), `teclado-mecanico-rgb-switch-brown` (0.5002), `moletom-hoodie-minimalista-com-capuz` (0.4873)
- **`upsell`:** `luminaria-de-mesa-articulada-nordica` (0.6772, 1.99x)
- **`cross_sell`:** `suporte-articulado-para-notebook-aluminio` (0.6838), `teclado-mecanico-rgb-switch-brown` (0.5002), `carteira-slim-em-couro-legitimo` (0.4723), `cafeteira-prensa-francesa-inox-600ml` (0.4496)

### 9. `moletom-hoodie-minimalista-com-capuz` (`casacos-e-moletons`, R\$ 219,00)
- **`related`:** `jaqueta-jeans-trucker-vintage` (0.6149), `bolsa-mala-de-viagem-duffle-weekend` (0.5468), `camiseta-basica-algodao-pima-premium` (0.5232), `mochila-urbana-impermeavel-antifurto` (0.5216), `tenis-casual-canvas-vintage` (0.5115)
- **`upsell`:** `jaqueta-jeans-trucker-vintage` (0.6149, 1.18x)
- **`cross_sell`:** `bolsa-mala-de-viagem-duffle-weekend` (0.5468), `camiseta-basica-algodao-pima-premium` (0.5232), `mochila-urbana-impermeavel-antifurto` (0.5216), `tenis-casual-canvas-vintage` (0.5115)

### 10. `tenis-running-ultralight-performance` (`esportivos`, R\$ 379,90)
- **`related`:** `tenis-casual-canvas-vintage` (0.6190), `mochila-urbana-impermeavel-antifurto` (0.5233), `cadeira-de-escritorio-ergonomica-mesh` (0.5166), `camiseta-basica-algodao-pima-premium` (0.5111), `bolsa-mala-de-viagem-duffle-weekend` (0.5071)
- **`upsell`:** *(vazio — único produto em `esportivos`)*
- **`cross_sell`:** `mochila-urbana-impermeavel-antifurto` (0.5233), `camiseta-basica-algodao-pima-premium` (0.5111), `bolsa-mala-de-viagem-duffle-weekend` (0.5071), `moletom-hoodie-minimalista-com-capuz` (0.4799)

---

## 4. Pontos Estranhos Sinalizados para Revisão Humana

1. **`mouse-optico-ergonomico-sem-fio` (`related`):** `teclado-mecanico-rgb-switch-brown` (mesma subcategoria `perifericos`) ficou de fora por ter similaridade `0.4472` (apenas `0.0028` abaixo do corte `0.45`), enquanto `oculos-de-realidade-virtual-imersivo` (`0.5669`) ficou em #1. Caso queira priorizar o teclado, uma opção é baixar `RECOMMENDATIONS_RELATED_MIN_SIMILARITY` para `0.43` ou curar manualmente.
2. **`oculos-de-grau-bloqueio-luz-azul` (`related` e `cross_sell`):** `oculos-de-realidade-virtual-imersivo` aparece alto (`0.5424`) devido à sobreposição lexical de "óculos" e à regra herdada `acessorios -> eletronicos`.
3. **`tenis-running-ultralight-performance` (`related` #3):** `cadeira-de-escritorio-ergonomica-mesh` (`0.5166`) surge por compartilharem vocabulário de "mesh/ergonômico/respirável" e por `calcados` ter apenas 2 itens no seed.
4. **`organizador-de-mesa-em-madeira-aluminio` (`related` #5):** `moletom-hoodie-minimalista-com-capuz` (`0.4873`) entra pelo vocabulário "minimalista" na expansão global acima de `0.45`.
5. **`cafeteira-prensa-francesa-inox-600ml` (`cross_sell` #3/#4):** `suporte-articulado-para-notebook-aluminio` e `oculos-de-sol-polarizado-classic-aviator` aparecem pela regra herdada da raiz `casa-e-decoracao -> acessorios`. Se preferir cross-sell mais restrito para cozinha, basta remover a regra de raiz `casa-e-decoracao -> acessorios`.
