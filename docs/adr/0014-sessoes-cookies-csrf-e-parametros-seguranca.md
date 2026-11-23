# ADR-0014: Sessões Opacas, Cookies (`__Host-`), Senhas (Argon2id) e Proteção CSRF

- **Status:** Accepted
- **Date:** 2026-11-22
- **Phase:** Fase 5 — Identidade, Segurança e Auditoria (`I01`, ref. spec `ADR-011`, estende [`ADR-0007`](./0007-autenticacao-sessoes-opacas-propria.md))

---

## Contexto

O [`ADR-0007`](./0007-autenticacao-sessoes-opacas-propria.md) definiu a estratégia de autenticação própria com sessões opacas no PostgreSQL, separação estrita entre clientes (`identity.customers`) e equipe (`identity.staff_users`), e hashing com Argon2id. Na implementação da Fase 5 (`I01`), é necessário fixar os parâmetros criptográficos, prazos de expiração, atributos de cookies, topologia de CSRF, política de senhas e redação de logs de acordo com as recomendações vigentes da OWASP.

---

## Fontes Consultadas (2026-11-22)

- **OWASP Password Storage Cheat Sheet** (consultado em `2026-11-22`): recomenda **Argon2id** como algoritmo primário com piso mínimo `m=19 MiB` (`19456 KiB`), `t=2`, `p=1`, armazenando parâmetros no formato PHC para permitir upgrade transparente (rehash no login).
- **OWASP Session Management Cheat Sheet** (consultado em `2026-11-22`): recomenda tokens aleatórios de alta entropia, timeouts **ocioso** e **absoluto** aplicados no servidor (15–30 min ocioso / 4–8 h absoluto para backoffice/admin), regeneração de ID no login, revogação imediata no servidor e cookies `HttpOnly`, `Secure`, `SameSite=Lax` com escopo restrito (`Path=/`, sem `Domain`).

---

## Decisão

### 1. Sessões Opacas e Expiração Dupla
- **Entropia e armazenamento:** token aleatório de **32 bytes** (`crypto.randomBytes(32).toString('base64url')`). O cookie carrega o token cru; o banco (`identity.sessions.token_hash`) armazena **exclusivamente o SHA-256** (hex).
- **Regeneração no login:** cada login cria um novo registro de sessão com token inédito (e revoga eventual sessão anterior no mesmo cookie), eliminando fixação de sessão.
- **Prazos (configuráveis por env):**
  - **Cliente:** ocioso `7 dias` (`CUSTOMER_SESSION_IDLE_TTL_SECONDS=604800`), absoluto `30 dias` (`CUSTOMER_SESSION_ABSOLUTE_TTL_SECONDS=2592000`).
  - **Staff:** ocioso `30 minutos` (`STAFF_SESSION_IDLE_TTL_SECONDS=1800`), absoluto `8 horas` (`STAFF_SESSION_ABSOLUTE_TTL_SECONDS=28800`).
- **Renovação deslizante com piso de escrita:** `expires_at` e `last_seen_at` só são atualizados no banco quando `now - last_seen_at >= SESSION_TOUCH_THRESHOLD_SECONDS` (default `300s`), sempre limitados por `absolute_expires_at`.
- **Limpeza periódica:** job no worker executa `cleanupExpiredSessions()` com `pg_try_advisory_xact_lock`, impedindo execução duplicada entre réplicas do worker.

### 2. Cookies e Topologia Suportada
- **Separação de áreas:** cookies distintos para storefront e backoffice:
  - Em dev/test (`COOKIE_SECURE=false`): `sid_customer` e `sid_staff`.
  - Em produção (`COOKIE_SECURE=true`, obrigatório no boot): `__Host-sid_customer` e `__Host-sid_staff`.
- **Atributos:** `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` conforme `COOKIE_SECURE`, **sem atributo `Domain`** (exigência do prefixo `__Host-`).
- **Topologia suportada:** storefront e API servidos no **mesmo site** (mesmo registrable domain ou proxy reverso), com origens liberadas em `CORS_ORIGINS` e `credentials: true`.
- **O que mudaria entre domínios distintos (cross-site):** seria obrigatório `SameSite=None; Secure`, a perda da proteção nativa de `SameSite=Lax` contra CSRF (tornando `Origin` + `x-csrf-token` ainda mais críticos) e atenção a bloqueios de cookies de terceiros em navegadores modernos.

### 3. Política de Senhas e Argon2id
- **Política:** tamanho mínimo **12** e máximo **128** caracteres, normalização Unicode **NFKC**, sem regras arbitrárias de composição, bloqueio contra lista versionada de ~1.000 senhas comuns e bloqueio quando igual ao e-mail normalizado.
- **Argon2id (`argon2@0.45.2`):** defaults alinhados ao piso OWASP (`ARGON2_MEMORY_COST=19456`, `ARGON2_TIME_COST=2`, `ARGON2_PARALLELISM=1`), configuráveis por env, com **rehash automático** no login quando `argon2.needsRehash()` retornar `true` e verificação contra hash "fantasma" para e-mails inexistentes (paridade de tempo).

### 4. Defesa em Profundidade contra CSRF
1. **Validação estrita de `Origin`:** toda requisição que altera estado (`POST`, `PUT`, `PATCH`, `DELETE`) — incluindo rotas sem sessão (login, cadastro, esqueci-a-senha, redefinição) e favoritos da Fase 2 — exige cabeçalho `Origin` presente e listado em `CORS_ORIGINS`; caso contrário retorna `403 CSRF_INVALID`.
2. **Token CSRF atrelado à sessão:** `HMAC-SHA256(CSRF_SECRET, "csrf:" + sessionId)` comparado em tempo constante (`crypto.timingSafeEqual`), emitido em `GET /auth/csrf` (cliente) e `GET /admin/auth/csrf` (staff), e exigido no cabeçalho `x-csrf-token` em toda rota que altera estado quando há sessão autenticada ativa (inclusive favoritos de cliente logado).

### 5. Rate Limiting, Cabeçalhos e Redação de Logs
- Porta `RateLimiter` com adaptador `InMemoryRateLimiter` (futuramente substituível por Redis), aplicando janela deslizante + backoff exponencial progressivo (sem bloqueio permanente de conta) por conta e por IP (com `TRUST_PROXY` configurável).
- `@fastify/helmet@13.2.0` com `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `CSP default-src 'none'`, `HSTS` quando `COOKIE_SECURE=true`, remoção de `x-powered-by`/`server`, e `Cache-Control: no-store` em `/me`, `/auth/*` e `/admin/*`.
- Redação central no Pino (`[REDACTED]`) para `authorization`, `cookie`, `set-cookie`, `x-csrf-token`, `password`, `token`, `hash` e `secret`.
- Em `NODE_ENV=production`, o boot **falha** se `COOKIE_SECURE=false` ou se `COOKIE_SECRET`, `CSRF_SECRET` ou `EMAIL_TOKEN_SECRET` estiverem ausentes, curtos (< 32 chars) ou iguais aos valores de exemplo.

---

## Consequências

- **Positivas:** revogação instantânea de sessões, defesa contra fixação de sessão, CSRF, enumeração, timing attacks e vazamento em logs; parâmetros ajustáveis por ambiente sem quebra de hashes existentes.
- **Negativas / Trade-offs:** o limitador em memória não compartilha estado entre múltiplas instâncias da API (documentado como evolução para Redis em fase futura).
