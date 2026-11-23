# Guia de Simulação de Caos no Storefront (DEV Only)

Em ambiente de desenvolvimento (`NODE_ENV=development` e `CHAOS_ENABLED=true` na API, e `import.meta.env.DEV === true` no storefront), o cliente HTTP (`apps/storefront/src/infrastructure/http/httpClient.ts`) injeta automaticamente os cabeçalhos de caos reconhecidos pelo middleware da API (`apps/api/src/common/chaos.middleware.ts`).

> **Segurança em Produção:** todo o código de leitura e envio de cabeçalhos `x-chaos-*` é protegido por `if (import.meta.env.DEV)` e **eliminado do bundle de produção** via tree-shaking do Vite/Rollup. Na API, o boot falha explicitamente se `NODE_ENV=production` e `CHAOS_ENABLED=true`.

## Chaves suportadas no `localStorage`

| Chave `localStorage` | Cabeçalho HTTP enviado | Exemplo | Efeito na API |
| :--- | :--- | :--- | :--- |
| `chaos.delay` | `x-chaos-delay` | `800` ou `200-800` | Atrasa a resposta em ms (teto 10000ms) |
| `chaos.fail` | `x-chaos-fail` | `1` ou `0.5` | Probabilidade de retornar `503 CHAOS_FAILURE` |
| `chaos.status` | `x-chaos-status` | `500`, `429`, `502` | Força o status HTTP informado com código `CHAOS_FAILURE` |

## Como ativar

### Opção 1 — Console do DevTools (ou Playwright)
```js
// Simular latência de 800ms
localStorage.setItem('chaos.delay', '800');

// Simular falha 503 em 100% das chamadas
localStorage.setItem('chaos.fail', '1');

// Forçar HTTP 429
localStorage.setItem('chaos.status', '429');

// Limpar tudo
localStorage.removeItem('chaos.delay');
localStorage.removeItem('chaos.fail');
localStorage.removeItem('chaos.status');
```

### Opção 2 — Painel flutuante de Caos em DEV
No canto inferior esquerdo da aplicação em modo `DEV`, clique no botão **Chaos Dev** para alternar atraso, falha forçada, status HTTP e invalidar o cache do React Query. Esse componente é carregado somente quando `import.meta.env.DEV` é verdadeiro.
