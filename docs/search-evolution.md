# Evolução da Busca: Migração de Listagem e Filtros para o Motor (`S10`)

Documento arquitetural de referência para o [`ADR-0010`](./adr/0010-meilisearch-como-motor-de-busca.md) *(spec ADR-005)* descrevendo como evoluir o uso do motor de busca além da caixa de busca quando a escala ou o produto justificarem.

---

## 1. Estado Atual (Fase 3)

- **Motor de busca (Meilisearch):** atende **exclusivamente a caixa de busca** (`GET /search` e `GET /search/suggest`), oferecendo busca textual tolerante a erros de digitação, sinônimos em português e busca híbrida com embeddings.
- **PostgreSQL (rotas da Fase 2):** continua atendendo integralmente a navegação estruturada do catálogo — árvore de categorias (`GET /categories`), listagem paginada por cursor com filtros de preço/estoque/atributos (`GET /products`), facetas disjuntivas (`GET /products/facets`) e detalhe do produto (`GET /products/:slug`).
- **Hidratação:** mesmo em `GET /search`, o motor devolve apenas os `id`s ordenados; os `ProductCardDTO` são hidratados a partir do PostgreSQL na ordem do motor, garantindo preço, estoque e status de publicação sempre consistentes com a fonte da verdade.

---

## 2. Gatilhos para Migrar Listagem e Filtros para o Motor

A migração só deve ocorrer quando um ou mais dos gatilhos abaixo se tornarem reais:

1. **Facetas lentas ou caras no PostgreSQL:** crescimento significativo do catálogo (dezenas ou centenas de milhares de SKUs) tornando as múltiplas agregações disjuntivas em JSONB (`GET /products/facets`) custosas em CPU/I/O mesmo com índices otimizados.
2. **Combinação intensa de busca livre + filtros + correção de digitação na mesma tela:** necessidade de o usuário digitar uma consulta com typos e imediatamente refinar por dezenas de atributos e facetas disjuntivas em uma única tela de exploração.
3. **Experiência unificada de busca e navegação:** desejo de consolidar ordenação, relevância e contagens de facetas sob o mesmo motor tanto em páginas de categoria quanto na página de resultados de busca, garantindo contagens e comportamento idênticos.

---

## 3. O Que Mudaria na Arquitetura

- **Adaptadores atrás do `SearchPort`:** as rotas existentes de listagem (`GET /products`), facetas (`GET /products/facets`) e filtros passam a delegar para implementações do `SearchPort` (Meilisearch), mantendo as consultas atuais em PostgreSQL como **fallback automático** em caso de indisponibilidade do motor.
- **Frontend e estado na URL:** os filtros da UI podem passar a consumir os hooks do ecossistema InstantSearch (ou cliente unificado sobre a API), preservando toda a seleção de categoria, preço, atributos e página sincronizada na URL para compartilhamento e navegação do navegador.
- **SEO em páginas de categoria (SSR):** as páginas de categoria continuam renderizadas no servidor (ex.: Next.js) consultando o motor **a partir do servidor** (nunca expondo o motor diretamente ao navegador), garantindo HTML indexável completo e mantendo o controle de segurança e hidratação no backend.
- **Consistência eventual de preço e estoque:** caso se opte por ler preço e disponibilidade diretamente do índice para eliminar a etapa de hidratação nos cards de listagem, o índice terá um atraso de alguns segundos em relação ao PostgreSQL (via outbox/worker). Nesse cenário, preço e estoque no card podem ficar levemente defasados, mas **carrinho e checkout sempre recalculam e validam diretamente no PostgreSQL**. *(Hoje esse risco já é eliminado pela hidratação a partir do PostgreSQL na resposta de `/search`.)*

---

## 4. Riscos e Mitigações

| Risco | Impacto | Mitigação |
| :--- | :--- | :--- |
| **Duas implementações de filtro** (Postgres e Meilisearch) divergindo em semântica ou contagens | Resultados diferentes entre operação normal e fallback, ou facetas incompatíveis | Manter um **contrato único** em `@minieshop/contracts` e uma **suíte automatizada de testes de equivalência** comparando a resposta do motor contra o PostgreSQL para a mesma matriz de filtros. |
| **Dessincronização do índice** após falhas prolongadas ou alterações de schema/settings | Produtos ausentes, desatualizados ou órfãos nas listagens | O pipeline de **outbox + worker** (com retry, backoff, dead-letter e `outbox:requeue`) garante entrega eventual, enquanto `pnpm search:reindex` (com swap atômico) e `pnpm search:status` permitem reconstrução e auditoria completas a qualquer momento. |
| **Explosão de atributos filtráveis** no índice | Aumento de memória e tempo de indexação no motor | Curadoria explícita via `catalog.attribute_definitions.is_filterable`, limitando os atributos promovidos ao índice. |
