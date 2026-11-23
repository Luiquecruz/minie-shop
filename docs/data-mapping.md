# Mapeamento de Dados — `src/data/products.ts` (`T05`)

Análise completa da fonte legada do SPA (`src/data/products.ts`, leitura apenas) para orientar a modelagem do banco (`T07`), a árvore de categorias/atributos (`T06`) e a fixture de seed (`T09`).

---

## 1. Inventário Geral

- **Total de produtos:** `30` (`id` sequencial de `1` a `30`).
- **Formato original:** array `RAW_PRODUCTS` enriquecido no carregamento do módulo (`PRODUCTS_MOCK`) por 3 funções sintéticas (`calculatePrice`, `generateGalleryImages`, `generateSpecs`, `generateManufacturerInfo`).
- **Moeda base:** implícita em `BRL` (valores em ponto flutuante).
- **Variantes (cor, tamanho, voltagem):** **não existem** em `products.ts`. Mesmo itens de `Vestuário` (#13–#15) e `Calçados` (#11–#12) são modelados como SKU único sem grade de cor/tamanho. Portanto, `catalog.product_variants` **não é necessária** na Fase 1 (pode ser introduzida em fase posterior se houver demanda).

---

## 2. Mapeamento Campo a Campo

| Campo em `products.ts` | Origem | Tipo atual | Destino no Backend | Observações |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `RAW_PRODUCTS` | `number` (`1..30`) | **Coluna** (`catalog.products.sku` / `slug`, novo `id` UUID) | Novo PK `uuid` no banco; `id` legado mapeado para `sku` (`MS-00001`..`MS-00030`) e `slug` único gerado a partir do `name`. |
| `name` | `RAW_PRODUCTS` | `string` | **Coluna** (`catalog.products.name`) | Indexado também no `tsvector` (`portuguese` + `unaccent`). |
| `description` | `RAW_PRODUCTS` | `string` | **Coluna** (`catalog.products.description`) | Indexado no `tsvector`. Parte das especificações técnicas embutidas no texto é extraída para `attributes` JSONB. |
| `category` | `RAW_PRODUCTS` | `string` (5 valores planos) | **Coluna FK** (`catalog.products.category_id` -> `catalog.categories.id`) | Normalizado para árvore hierárquica de categorias (`T06`). |
| `price.regular_price` | `RAW_PRODUCTS` | `number` (float BRL) | **Coluna** (`catalog.products.regular_price_cents` `integer >= 0`) | Convertido para centavos (`Math.round(val * 100)`). |
| `price.special_price` | `RAW_PRODUCTS` | `number \| null` (float BRL) | **Coluna** (`catalog.products.special_price_cents` `integer \| null`, `>= 0`) | `null` quando não há promoção (10 de 30 produtos). Constraint: `special_price_cents <= regular_price_cents`. |
| *(implícito)* moeda | — | `'BRL'` implícito | **Coluna** (`catalog.products.currency`, default `'BRL'`) | Código ISO-4217 (`char(3)` / `text`). |
| `price.final_price` | Derivado (`calculatePrice`) | `number` | **Descartado (derivado)** | Calculado em consulta/serviço (`COALESCE(special_price_cents, regular_price_cents)`). |
| `price.discount_percentage` | Derivado (`calculatePrice`) | `number` | **Descartado (derivado)** | Calculado dinamicamente a partir de `regular_price_cents` e `special_price_cents`. |
| `stock` | `RAW_PRODUCTS` | `number` (`5..65`) | **Coluna em `inventory`** (`inventory.stock_items.quantity`) + **Projeção** (`catalog.products.in_stock` `boolean`) | Segue `ADR-0006`: `inventory` é dono do estoque; `catalog` mantém projeção booleana `in_stock`. |
| `rating.rate` | `RAW_PRODUCTS` | `number` (`4.3..4.9`) | **Coluna** (`catalog.products.rating_average` `numeric(3,2)`) | Mantido como resumo agregado até existir módulo dedicado de avaliações. |
| `rating.count` | `RAW_PRODUCTS` | `number` (`39..320`) | **Coluna** (`catalog.products.rating_count` `integer >= 0`) | Contagem de avaliações verificadas. |
| `image` | `RAW_PRODUCTS` | `string` (URL Unsplash) | **`media.media_assets` + `catalog.product_images`** | Baixada para fixture local (`T09`), processada via `MediaService` (original + variantes WebP + placeholder base64). |
| `images` | Derivado (`generateGalleryImages`) | `string[]` (4 URLs) | **Descartado (sintético)** | Repete a mesma URL do Unsplash com `&ar=4:5`, `&ar=1:1`, `&ar=3:4`. No backend, cada entrada em `product_images` representa um ativo real. |
| `specs` | Derivado (`generateSpecs`) | `Array<{label, value}>` | **Atributo JSONB** (`catalog.products.attributes`) + colunas | O boilerplate fixo (garantia 12 meses, certificação, embalagem) é substituído por atributos estruturados reais em `products.attributes` (JSONB) descritos em `attribute_definitions` (`T06`). |
| `manufacturer` | Derivado (`generateManufacturerInfo`) | `ManufacturerInfo` | **Atributo JSONB / Descartado** | `brand` era sintético (`Minie Certified Partner — <categoria>`). Marca e garantia passam a atributos estruturados (`brand`, `warranty_months`) quando aplicável; textos genéricos repetidos são descartados. |

---

## 3. Valores Repetidos (Categorias, Marcas e Tags)

### Categorias existentes (5 valores planos)

| Categoria em `products.ts` | Quantidade | IDs dos Produtos |
| :--- | :---: | :--- |
| `Eletrônicos` | 11 | #1, #2, #3, #4, #5, #6, #21, #22, #23, #27, #28 |
| `Acessórios` | 8 | #7, #8, #9, #10, #24, #25, #26, #30 |
| `Casa & Decoração` | 6 | #16, #17, #18, #19, #20, #29 |
| `Vestuário` | 3 | #13, #14, #15 |
| `Calçados` | 2 | #11, #12 |
| **Total** | **30** | **#1 a #30** |

### Marcas e Tags
- **Marcas (`brand`):** não existem nos dados brutos (`RAW_PRODUCTS`); todas eram geradas artificialmente como `Minie Certified Partner — ${category}`.
- **Tags:** não existem nos dados brutos.

---

## 4. Origem das Imagens e Produtos sem Imagem

- **Origem:** **100% URLs remotas do Unsplash** (`https://images.unsplash.com/photo-<id>?auto=format&fit=crop&w=600&q=80`). Não há imports locais nem arquivos estáticos em `src/assets/` referenciados por `products.ts`.
- **Galeria (`images`):** sintética — `generateGalleryImages()` apenas clona a mesma URL 4 vezes alterando o parâmetro `ar`.
- **Produtos sem imagem em `products.ts`:** **0** (todos os 30 produtos têm URL válida).
  - *Nota para `T09` (decisão alinhada):* na fixture de seed (`apps/api/seed/`), deixaremos propositalmente **2 produtos sem imagem** (mantendo o total de 30 produtos) para exercitar o fallback no frontend (`ADR-0005`).

---

## 5. Inconsistências Identificadas

1. **Idioma misto:** `name`, `description` e `category` estão em `pt-BR`, enquanto `specs` e `manufacturer` gerados estão hardcoded em `en-US`.
2. **Preços em float:** uso de ponto flutuante (`399.9`, `199.9`) sujeito a erro de precisão binária; no banco será inteiro em centavos (`39990`, `19990`).
3. **Ausência de `slug` e `sku` reais:** `slug` não existe; `sku` é derivado em runtime (`MS-00001`).
4. **Especificações técnicas presas em texto livre:** atributos valiosos para filtros e cards estão apenas na `description` ou no `name` — por exemplo:
   - Autonomia de bateria (`40h` no #1, `15h` no #5, `31min` no #22, `35h` queima no #19).
   - Resistência à água (`50m` no #2, `IPX7` no #5, impermeável no #7).
   - Conectividade (`Bluetooth` no #1/#5/#23, `Sem Fio` no #4/#21/#28, `USB` no #7).
   - Capacidade (`750ml` no #10, `250ml` no #17, `600ml` no #18, `128GB` no #27).
   - Material (`Alumínio` no #3/#29/#30, `Couro Legítimo` no #9/#25, `Inox` no #10/#18, `Algodão` no #13/#14, `Cerâmica` no #17, `Madeira` no #16/#29, `Mesh` no #20).
   - Potência / DPI / Tela (`4000 DPI` no #4, `15W` no #21, `10.5"` / `120Hz` no #27, `4K` no #6/#22).
5. **Fronteira difusa entre categorias planas:** `Suporte Articulado para Notebook Alumínio` (#30) está em `Acessórios`, enquanto `Organizador de Mesa em Madeira & Alumínio` (#29) e `Cadeira de Escritório Ergonômica Mesh` (#20) estão em `Casa & Decoração`. Uma subcategoria de **Escritório & Home Office** (ou subcategorias claras) resolve isso na `T06`.
