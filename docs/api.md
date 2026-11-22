# Referência da API Pública do Catálogo (Fase 2)

Documentação de referência para integração do frontend e clientes HTTP com a API do **Progressive Minie Shop** (`http://localhost:3001`).

---

## 1. Convenções Gerais

- **Sem prefixo de versão** nas rotas públicas (`/categories`, `/products`, `/products/facets`, `/products/:slug`, `/favorites`, `/health`, `/ready`).
- **Valores monetários:** sempre em **centavos** (inteiro) + código ISO-4217 em `MoneyDTO`: `{ "amount": 29990, "currency": "BRL" }`. O campo `price` expõe o preço efetivo (`COALESCE(special_price_cents, regular_price_cents)`).
- **IDs:** UUID serializado como `string`.
- **Produtos publicados:** todas as rotas públicas filtram estritamente `catalog.products.status = 'published'`.
- **Contratos estritos:** todas as respostas passam por `Schema.parse` com `.strict()` em `@minieshop/contracts` (`packages/contracts/src/catalog/public.ts`).
- **CORS:** origens permitidas via `CORS_ORIGINS` (lista separada por vírgula; default `http://localhost:5199`, porta do dev server do SPA), com `credentials: true` e cabeçalhos `x-chaos-*` liberados no preflight.
- **Cache HTTP:**
  - `/categories`, `/products`, `/products/facets`, `/products/:slug`: `Cache-Control: public, max-age=30` + `ETag` fraco (`W/"..."`, com suporte a `If-None-Match` -> `304 Not Modified`).
  - `/favorites` e `/favorites/:productId`: `Cache-Control: no-store`.
- **Rastreabilidade:** toda resposta inclui o cabeçalho `x-request-id` (reaproveitado do header enviado ou gerado como UUID).

---

## 2. Formato Padronizado de Erro

Todas as respostas de erro (validação, 404, caos, erro interno) seguem o mesmo envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "path": "limit",
        "message": "Number must be less than or equal to 60"
      }
    ],
    "requestId": "9f8c7a6b-..."
  }
}
```

Códigos estáveis (`ErrorCode`):
- `VALIDATION_ERROR` (`400`) — parâmetros de query, path ou payload inválidos (com `details` por campo).
- `NOT_FOUND` (`404`) — rota inexistente, produto não encontrado ou não publicado.
- `RATE_LIMITED` (`429`) — reservado para limitação de taxa.
- `CHAOS_FAILURE` (`503` ou status forçado) — erro simulado pelo middleware de caos em ambiente não-produtivo.
- `INTERNAL_ERROR` (`500`) — erro inesperado (sem stack trace na resposta; stack completo gravado no log estruturado com `requestId`).

---

## 3. Middleware de Caos (somente não-produção)

O middleware de caos só é ativado quando `CHAOS_ENABLED=true` **e** `NODE_ENV !== 'production'`.
Se `NODE_ENV=production` e `CHAOS_ENABLED=true`, a aplicação **falha no boot** com erro explícito.
Quando ativo, um aviso `warn` é emitido no log de inicialização. As rotas `/health` e `/ready` são sempre isentas.

### Cabeçalhos suportados

| Cabeçalho | Formato | Comportamento |
| :--- | :--- | :--- |
| `x-chaos-delay` | Inteiro em ms (`500`) ou faixa (`200-800`), teto `10000` | Atraso artificial antes de processar a requisição |
| `x-chaos-fail` | Probabilidade entre `0` e `1` (`0.5`, `1`) | Retorna `503` com erro padronizado `CHAOS_FAILURE` |
| `x-chaos-status` | Status HTTP `400..599` (ex.: `429`, `502`) | Força o status HTTP informado com código `CHAOS_FAILURE` |

### Exemplos com `curl`

```bash
# Latência fixa de 400ms
curl -i -H "x-chaos-delay: 400" http://localhost:3001/categories

# Latência aleatória entre 150ms e 600ms
curl -i -H "x-chaos-delay: 150-600" http://localhost:3001/products

# Forçar 100% de falha 503 CHAOS_FAILURE
curl -i -H "x-chaos-fail: 1" http://localhost:3001/products

# Forçar status 429
curl -i -H "x-chaos-status: 429" http://localhost:3001/products
```
