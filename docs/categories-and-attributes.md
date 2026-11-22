# Árvore de Categorias e Definições de Atributos (`T06`)

> **Status:** Aguardando aprovação humana antes de iniciar a `T07` (Modelagem e Migrations).

Proposta baseada no mapeamento de `src/data/products.ts` ([`docs/data-mapping.md`](./data-mapping.md)) e nos filtros necessários para o catálogo.

---

## 1. Árvore de Categorias Proposta (`catalog.categories`)

Mantemos as **5 categorias raiz** já familiares ao SPA (garantindo compatibilidade natural na migração futura) e introduzimos **subcategorias de 2º nível** que agrupam os 30 produtos de forma semântica para navegação e filtros:

```text
├── eletronicos ("Eletrônicos")
│   ├── audio ("Áudio")                        # #1 Fone Over-Ear, #5 Caixa de Som, #23 Earbuds TWS
│   ├── perifericos ("Periféricos")            # #3 Teclado Mecânico, #4 Mouse Ergonômico
│   ├── wearables-e-vr ("Wearables & VR")      # #2 Smartwatch, #28 Óculos VR
│   ├── foto-video-e-drones ("Foto, Vídeo & Drones") # #6 Câmera Mirrorless, #22 Drone 4K
│   └── tablets-e-energia ("Tablets & Energia") # #21 Carregador Sem Fio 15W, #27 Tablet 10.5"
│
├── acessorios ("Acessórios")
│   ├── bolsas-e-mochilas ("Bolsas & Mochilas") # #7 Mochila Urbana, #26 Mala Duffle
│   ├── oculos-e-relogios ("Óculos & Relógios") # #8 Óculos de Sol, #24 Óculos Luz Azul, #25 Relógio Analógico
│   ├── dia-a-dia ("Dia a Dia")                 # #9 Carteira Couro, #10 Garrafa Térmica 750ml
│   └── suporte-e-setup ("Suporte & Setup")     # #30 Suporte Notebook Alumínio
│
├── casa-e-decoracao ("Casa & Decoração")
│   ├── home-office ("Home Office")             # #16 Luminária Nórdica, #20 Cadeira Mesh, #29 Organizador de Mesa
│   ├── cozinha-e-cafe ("Cozinha & Café")       # #17 Kit Xícaras Cerâmica, #18 Prensa Francesa 600ml
│   └── bem-estar ("Bem-estar & Aromas")        # #19 Vela Aromática Soja & Baunilha
│
├── vestuario ("Vestuário")
│   ├── camisetas ("Camisetas")                 # #14 Camiseta Algodão Pima
│   └── casacos-e-moletons ("Casacos & Moletons") # #13 Jaqueta Jeans, #15 Moletom Hoodie
│
└── calcados ("Calçados")
    ├── esportivos ("Esportivos")               # #11 Tênis Running Ultralight
    └── casuais ("Casuais")                     # #12 Tênis Casual Canvas
```

### Observações sobre a árvore
- **Profundidade máxima inicial:** 2 níveis (`parent_id = NULL` para raízes, `parent_id = <raiz>` para folhas), mas a tabela `catalog.categories` suporta profundidade arbitrária via `parent_id` + `sort_order`.
- **Contagem por raiz preservada:** `Eletrônicos` (11), `Acessórios` (8), `Casa & Decoração` (6), `Vestuário` (3), `Calçados` (2) = **30 produtos** (exatamente a mesma distribuição do SPA).
- **Filtro por categoria pai:** consultar uma categoria raiz retornará todos os produtos das suas subcategorias.

---

## 2. Definições de Atributos Iniciais (`catalog.attribute_definitions`)

Os atributos abaixo serão armazenados em `catalog.products.attributes` (JSONB com índice GIN) e descritos formalmente em `catalog.attribute_definitions`:

| `code` | `label` (pt-BR) | `data_type` | `unit` | `is_filterable` | `show_on_card` | `icon_key` | Exemplos nos 30 produtos |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `material` | Material | `enum` / `string` | `null` | `true` | `true` | `layers` | Alumínio, Couro Legítimo, Inox, Algodão, Cerâmica, Mesh, Madeira |
| `connectivity` | Conectividade | `enum` / `string` | `null` | `true` | `true` | `wifi` | Bluetooth, Sem Fio (2.4GHz/BT), Qi Wireless, Com Fio |
| `water_resistant` | Resistente à água | `boolean` | `null` | `true` | `true` | `droplet` | `true` (#2, #5, #7), `false` |
| `battery_hours` | Autonomia de bateria | `number` | `h` | `true` | `true` | `battery` | `40` (#1), `15` (#5) |
| `capacity_ml` | Capacidade | `number` | `ml` | `true` | `true` | `cup` | `750` (#10), `600` (#18), `250` (#17) |
| `warranty_months` | Garantia | `number` | `meses` | `true` | `false` | `shield` | `12` (padrão do catálogo) |
| `noise_cancellation` | Cancelamento de ruído | `boolean` | `null` | `true` | `true` | `volume-x` | `true` (#1, #23) |
| `resolution` | Resolução | `string` | `null` | `true` | `false` | `video` | `4K`, `4K HDR` (#6, #22) |
| `power_watts` | Potência | `number` | `W` | `false` | `true` | `zap` | `15` (#21) |
| `screen_size_in` | Tamanho da tela | `number` | `pol` | `false` | `true` | `monitor` | `10.5` (#27) |
| `dpi` | Sensibilidade (DPI) | `number` | `DPI` | `false` | `false` | `crosshair` | `4000` (#4) |
| `uv_protection` | Proteção UV / Luz Azul | `string` | `null` | `true` | `true` | `sun` | `UV400` (#8), `Filtro Luz Azul` (#24) |

> **Observação sobre `icon_key`:** todas as chaves (`layers`, `wifi`, `droplet`, `battery`, `cup`, `shield`, `volume-x`, `video`, `zap`, `monitor`, `crosshair`, `sun`) são identificadores semânticos para o frontend mapear para **ícones SVG inline** (respeitando a política de zero emojis na UI).

---

## 3. Impacto no Backlog / Modelagem (`T07`)

- **Sem `product_variants` na Fase 1:** confirmado em `T05` que nenhum dos 30 produtos possui grade de cor/tamanho; `inventory.stock_items` referencia diretamente `catalog.products.id`.
- **Categorias novas para o seed (`T09`):** 5 categorias raiz + 15 subcategorias (20 registros em `catalog.categories`) e 12 registros em `catalog.attribute_definitions`.
- **Fallback de imagem (`T09`):** 2 produtos na fixture (sugestão: `#19 Vela Aromática` e `#29 Organizador de Mesa`) ficarão intencionalmente sem imagem no seed para validar o fallback do frontend.
