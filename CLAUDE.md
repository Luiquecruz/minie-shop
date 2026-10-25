# CLAUDE.md — Minie Shop Progressivo

Documento de contexto e diretrizes para agentes e desenvolvedores que atuarem neste repositório.

---

## 🎯 Visão Geral do Projeto
Projeto de uma aplicação **Minie Shop Progressiva** desenvolvida do zero (*from scratch*) com o objetivo de revisar conceitos fundamentais e avançados de React de forma incremental e didática.

---

## 📌 Status Atual & Regras de Condução
- **Fase Atual:** Fase 3 — Construção da PLP e catálogo de produtos.
- **Regra de Ouro (UI):** Emojis são estritamente **proibidos** na interface (UI). Utilize ícones vetoriais SVG, tipografia adequada ou recursos gráficos equivalentes.
- **Linguagem:** **JavaScript (JSX)** exclusivamente nesta etapa inicial.
  - *Nota:* A migração/adoção de **TypeScript** será realizada posteriormente, sob comando explícito do usuário.
- **Regra Crucial para Agentes:** Não antecipar a criação de componentes, páginas ou regras de negócio sem que o usuário solicite explicitamente o próximo passo. Proceda passo a passo.
- **Manutenção deste arquivo:** Sempre que novas decisões de arquitetura, dependências ou convenções forem introduzidas, atualize este arquivo `CLAUDE.md`.

---

## 🛠️ Stack Tecnológica Instalada
- **Build Tool:** [Vite](https://vite.dev/) `v8.x`
- **Biblioteca Principal:** [React](https://react.dev/) `v19.x` & `react-dom`
- **Roteamento:** [`react-router-dom`](https://reactrouter.com/) `v7.x`
- **Gerenciamento de Cabeçalho / SEO:** [`react-helmet-async`](https://github.com/staylor/react-helmet-async) `v3.x` *(adotado como substituto moderno e compatível com React 19/concurrency para o react-helmet original)*
- **Linter:** [Oxlint](https://oxc.rs/)

---

## 🚀 Scripts Disponíveis
```bash
npm run dev      # Inicia o servidor local de desenvolvimento Vite
npm run build    # Compila a aplicação para produção
npm run preview  # Visualiza localmente o bundle de produção
npm run lint     # Executa verificação com oxlint
```

---

## 📁 Estrutura de Arquivos Inicial
```text
react-minieshop/
├── CLAUDE.md              # Documentação e rastreamento para agentes
├── index.html             # Ponto de entrada HTML
├── package.json           # Dependências e scripts
├── vite.config.js         # Configuração do Vite com plugin React
└── src/
    ├── assets/            # Assets estáticos padrão
    ├── components/
    │   ├── Navbar/        # Barra de navegação com logotipo e indicador de carrinho
    │   └── ProductCard/   # Card de produto individual (imagem, rating, preço, ações)
    ├── data/
    │   └── products.js    # Base mock de 30 produtos (id, nome, preço, imagem, etc.)
    ├── pages/
    │   └── ProductListingPage/ # PLP com busca, filtros de categoria, ordenação e grid
    ├── services/
    │   └── api.js         # Camada de API simulada frontend-only (busca, filtro, paginação)
    ├── App.css            # Estilos de layout (shell, content, footer)
    ├── App.jsx            # Shell com BrowserRouter, HelmetProvider e rotas
    ├── index.css          # Design system com tokens CSS (light/dark mode)
    └── main.jsx           # Ponto de entrada React (createRoot)
```

---

## 🗺️ Roadmap de Evolução (Progressivo)
1. **Fase 1:** Inicialização limpa do projeto (Vite + React JS + React Router + React Helmet) ✅
2. **Fase 2:** Definição da estrutura de rotas e providers base (`BrowserRouter`, `HelmetProvider`) ✅
3. **Fase 3 (Atual):** Construção da PLP, layout e componentes de apresentação (Navbar, ProductCard, PLP com filtros e grid) ✅
4. **Fase 4:** Estado global e revisão de Hooks (`useState`, `useEffect`, `useContext` ou Reducer para carrinho e persistência).
5. **Fase 5:** Migração incremental para TypeScript.
