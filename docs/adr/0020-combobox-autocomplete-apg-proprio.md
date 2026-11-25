# ADR-0020: Combobox de Autocomplete no Cabeçalho — Implementação Própria WAI-ARIA APG vs Downshift

- **Status:** Accepted
- **Date:** 2026-11-24
- **Phase:** Fase 7 — Busca (`S08.2`)

## Contexto

O cabeçalho global (`Navbar` / `SearchBar`) precisa evoluir para um combobox de autocomplete acessível consumindo `GET /search/suggest` (máx. 8 sugestões + opção final `"Ver todos os resultados para «q»"`), com debounce (~200 ms a partir de 2 caracteres), cancelamento de requisições via `AbortSignal` (TanStack Query), navegação completa por teclado e compatibilidade com leitores de tela (VoiceOver).

Avaliamos usar uma biblioteca headless dedicada (`downshift@9.5.0`, `useCombobox`) versus implementar um hook próprio aderente ao padrão **WAI-ARIA Authoring Practices Guide (APG) — Editable Combobox with List Autocomplete**.

## Decisão

Adotar uma **implementação própria em React (`src/hooks/useCombobox.ts`)** seguindo rigorosamente a especificação **WAI-ARIA APG (Editable Combobox with List Autocomplete)**, sem adicionar `downshift` às dependências do projeto.

### Especificação de Acessibilidade (WAI-ARIA APG) Aplicada
- **Input (`role="combobox"`):**
  - `aria-expanded` (`true` quando o popup está visível, `false` caso contrário);
  - `aria-controls` apontando para o `id` estável do `<ul role="listbox">`;
  - `aria-autocomplete="list"`;
  - `aria-activedescendant` apontando para o `id` da opção destacada (ou ausente quando nenhuma opção está ativa — foco do DOM **nunca** sai do `<input>`);
  - `<label htmlFor={inputId} className="visually-hidden">` associado explicitamente.
- **Popup (`role="listbox"` e `role="option"`):**
  - `<ul role="listbox">` contém estritamente elementos `<li role="option" aria-selected={isHighlighted}>`;
  - estados auxiliares (carregando, `"Nenhuma sugestão"`, `"Não foi possível carregar sugestões"`) são renderizados em containers irmãos fora do `role="listbox"` para preservar semântica válida;
  - região `aria-live="polite"` dedicada anuncia `"N sugestões disponíveis"` ou `"Nenhuma sugestão"`.
- **Modelo de teclado:**
  - `ArrowDown` / `ArrowUp`: abre a lista se fechada e move o destaque via `aria-activedescendant`, rolando a opção visível via `scrollIntoView({ block: 'nearest' })`;
  - `Home` / `End`: quando a lista está aberta com opções, salta para a primeira/última opção (`preventDefault()` apenas quando aberto; fechado preserva movimentação nativa do cursor no texto);
  - `Enter`: com opção ativa navega para a PDP do `slug` (ou `/search?q=...` no item final); sem opção ativa (inclusive em carregando/vazio/erro) envia a busca para `/search?q=...` quando houver termo não vazio;
  - `Escape`: fecha o popup e limpa `highlightedIndex` mantendo o foco no input;
  - clique fora (`pointerdown`) e `Tab` fecham o popup sem armadilha de foco; `onMouseDown={(e) => e.preventDefault()}` nas opções evita perda de foco antes do clique.

## Alternativas Consideradas

- **Downshift (`downshift@9.5.0`, `useCombobox`):**
  - *Prós:* primitivas testadas pela comunidade para ARIA 1.2 combobox.
  - *Contras:* adiciona dependência externa (`downshift`, `react-is`, `prop-types`, `@babel/runtime`, `compute-scroll-into-view`, `tslib`) no chunk principal carregado em todas as rotas, enquanto na Fase 8 o projeto entrará em **componentes proprietários / design system próprio**, tornando uma biblioteca headless temporária redundante.

## Consequências

### Positivas
- **`0 B` de dependência externa** adicionada ao chunk principal (`index-*.js`) para o combobox do cabeçalho.
- Controle total do comportamento de teclado, foco, estados vazios/erro e opção fixa `"Ver todos os resultados para «q»"`, alinhado desde já à estratégia de componentes proprietários da Fase 8.
- Cobertura automática garantida por testes unitários/integração (`user-event` + `vitest-axe` com 0 violações) e inspeção manual com teclado e VoiceOver.

### Negativas / Trade-offs
- Responsabilidade integral de manter os manipuladores de teclado, `scrollIntoView` e eventos de ponteiro sem regressões — mitigada pela suíte dedicada de testes de comportamento e acessibilidade (`S08.4`).

## Notas de Evolução Incremental
- Na Fase 8 (Design System / componentes proprietários), `src/hooks/useCombobox.ts` pode ser promovido diretamente para o pacote de UI compartilhado como primitiva base de combobox/autocomplete.
