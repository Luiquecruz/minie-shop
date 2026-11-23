# ADR-0006: Organização do Banco de Dados — Um Schema por Módulo

- **Status:** Accepted
- **Date:** 2026-11-21
- **Phase:** Fase 1 — Fundação Backend (`T01`, ref. spec `ADR-008`)

## Contexto
No monolito modular (ADR-0002), todos os módulos compartilham uma única instância PostgreSQL. Sem isolamento lógico no banco, tabelas de diferentes domínios se misturam no schema `public`, facilitando queries cruzadas ad-hoc, acoplamento silencioso e perda de ownership dos dados.

## Decisão
- **Um schema PostgreSQL por módulo:** `catalog`, `media`, `recommendations`, `inventory`, `identity` e `platform`. O schema `public` não recebe tabelas de domínio (apenas extensões globais como `vector` e `unaccent`, quando instaladas nele).
- **Ownership estrito de escrita:** cada módulo escreve **apenas** nas tabelas do seu próprio schema.
- **Leitura entre módulos:**
  - Consultas pontuais entre módulos passam pela interface pública (`index.ts`) do módulo dono.
  - Listagens e filtros que precisam de estado derivado de outro módulo utilizam **projeções locais** dentro do schema consumidor (ex.: `catalog.products.in_stock` projetado a partir de `inventory.stock_items`), evitando `JOIN`s acoplados entre schemas em caminhos quentes de leitura.
- **Chaves estrangeiras entre schemas:** permitidas **exclusivamente** referenciando a chave primária (`id`) da tabela dona no outro schema (ex.: `catalog.product_images.media_asset_id -> media.media_assets.id`, `inventory.stock_items.product_id -> catalog.products.id`). Nunca referenciar colunas internas/não-PK de outro módulo.
- **Migrations versionadas:** organizadas de forma clara por schema/domínio e aplicadas em sequência pelo serviço `migrate`.

## Alternativas Consideradas
- **Sem FK entre schemas (integridade apenas na aplicação):** descartado nesta fase porque abre margem para registros órfãos (ex.: `product_images` apontando para `media_assets` inexistente ou `stock_items` sem produto) sem ganho real enquanto todos os módulos compartilham a mesma instância PostgreSQL. Caso um módulo seja extraído no futuro, remover a FK pontual é uma migration simples e controlada.
- **Todas as tabelas no schema `public` com prefixo de nome:** descartado por não oferecer fronteira visual/lógica nem permitir restringir permissões de roles de banco por schema no futuro.
- **Bancos de dados físicos separados por módulo:** descartado por introduzir complexidade operacional e perda de transações ACID locais prematuramente (violaria a premissa do monolito modular).

## Consequências
### Positivas
- Fronteiras de domínio refletidas fisicamente no PostgreSQL e nos arquivos de schema do Drizzle (`pgSchema`).
- Integridade referencial garantida pelo banco sem vazar detalhes internos entre módulos.
- Projeções locais (como `in_stock`) mantêm listagens de catálogo rápidas e desacopladas de `inventory`.

### Negativas / Trade-offs
- Exige manter projeções sincronizadas quando o estado fonte mudar (ex.: atualizar `catalog.products.in_stock` ao alterar estoque).
- Queries no Drizzle precisam importar os schemas explicitamente via `pgSchema('<modulo>')`.
