# Segurança — Progressive Minie Shop Backend (Fase 5)

Documentação consolidada de modelagem de ameaças, parâmetros efetivos de segurança, checklist verificado, auditoria de dependências e limites conhecidos da camada de identidade (`identity`) e auditoria (`platform`).

---

## 1. Modelo de Ameaças Enxuto (STRIDE)

### Ativos Protegidos
- Credenciais de clientes (`identity.customers.password_hash`) e de equipe (`identity.staff_users.password_hash`).
- Sessões ativas (`identity.sessions.token_hash`), cookies `sid_customer` / `sid_staff` (e variantes `__Host-` em produção).
- Tokens de uso único para verificação de e-mail e redefinição de senha (`identity.email_tokens`).
- Dados pessoais e endereços de clientes (`identity.customer_addresses`), favoritos (`catalog.favorites`) e trilha imutável de auditoria (`platform.audit_log`).

### Atores
- **Visitante anônimo** (navegador com ou sem cookie `anon_id`).
- **Cliente autenticado** (sessão `sid_customer`, autorizado estritamente por posse).
- **Membro do staff autenticado** (sessão `sid_staff`, autorizado por RBAC com negar-por-padrão).
- **Atacante externo / script malicioso cross-site** (tentativas de brute force, enumeração, CSRF, IDOR, session fixation, sequestro de token de e-mail).

### Matriz STRIDE
| Categoria | Ameaça Principal | Mitigação Implementada |
| :--- | :--- | :--- |
| **Spoofing** | Brute force, credential stuffing, session fixation, reutilização de cookie entre storefront e backoffice | Argon2id (OWASP), rate limiting progressivo por IP e conta (`429 + Retry-After`), regeneração de sessão no login, cookies distintos (`sid_customer` vs `sid_staff`), `HttpOnly`, `SameSite=Lax`, `__Host-` + `Secure` em produção. |
| **Tampering** | CSRF em rotas que alteram estado, adulteração de token de e-mail, elevação de papéis | Validação estrita de `Origin` contra `CORS_ORIGINS` em todo método de escrita + `x-csrf-token` (HMAC-SHA256 do `sessionId`, comparação em tempo constante); tokens de e-mail `<id>.<HMAC-SHA256>` + `SHA-256` no banco; proteção contra remoção do último `admin`. |
| **Repudiation** | Ações administrativas sem rastreabilidade ou perda de trilha em caso de erro | `AuditService.record(tx, ...)` na mesma transação dos casos de uso (atomicidade garantida), registrando ator, ação, `before`/`after` redigidos, IP, user-agent e `requestId`; tabela append-only sem rotas de mutação. |
| **Information Disclosure** | Enumeração de contas, IDOR, vazamento de PII/segredos em logs, respostas ou outbox | Respostas idênticas (`202` genérico / `401 INVALID_CREDENTIALS` com hash fantasma), posse com `404` (nunca `403`), menor privilégio em `GET /admin/customers`, schemas Zod `.strict()`, redação central no Pino e no `AuditService`, outbox sem segredos (somente `emailTokenId`), `Cache-Control: no-store`. |
| **Denial of Service** | Bloqueio permanente de conta por atacante, explosão de sessões expiradas | Backoff progressivo limitado (sem lockout permanente), limpeza periódica de sessões expiradas no worker com `pg_try_advisory_xact_lock`, limite de 10 endereços por cliente. |
| **Elevation of Privilege** | Rota `/admin/*` exposta sem permissão ou cliente acessando backoffice | Negar-por-padrão em `/admin/*` no `IdentityGuard` + teste automatizado que percorre 100% das rotas registradas e falha se alguma rota admin estiver sem decorator explícito. |

---

## 2. Parâmetros Efetivos e Fontes (Consultadas em 2026-11-22)

| Controle | Parâmetro Efetivo (Default) | Variável de Ambiente | Referência / Fonte |
| :--- | :--- | :--- | :--- |
| **Hashing de senha** | `Argon2id`, `m=19456 KiB` (19 MiB), `t=2`, `p=1`, rehash automático no login | `ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM` | OWASP Password Storage Cheat Sheet (2026-11-22); `argon2@0.45.2` |
| **Política de senha** | 12–128 chars, normalização NFKC, bloqueio de ~1.000 senhas comuns e senha igual ao e-mail | — | OWASP / NIST SP 800-63B |
| **Sessão Cliente** | Ocioso `7d` (`604800s`), Absoluto `30d` (`2592000s`), piso de escrita `5m` (`300s`) | `CUSTOMER_SESSION_IDLE_TTL_SECONDS`, `CUSTOMER_SESSION_ABSOLUTE_TTL_SECONDS`, `SESSION_TOUCH_THRESHOLD_SECONDS` | OWASP Session Management Cheat Sheet (2026-11-22) |
| **Sessão Staff** | Ocioso `30m` (`1800s`), Absoluto `8h` (`28800s`), piso de escrita `5m` (`300s`) | `STAFF_SESSION_IDLE_TTL_SECONDS`, `STAFF_SESSION_ABSOLUTE_TTL_SECONDS` | OWASP Session Management Cheat Sheet (2026-11-22) |
| **Cookies** | `sid_customer`/`sid_staff` (dev) ou `__Host-sid_customer`/`__Host-sid_staff` (prod); `HttpOnly`, `SameSite=Lax`, `Path=/`, sem `Domain` | `COOKIE_SECURE`, `COOKIE_SECRET` | OWASP Session Management Cheat Sheet (2026-11-22); [`ADR-0014`](./adr/0014-sessoes-cookies-csrf-e-parametros-seguranca.md) |
| **Tokens de e-mail** | `<id>.<HMAC-SHA256>`, uso único; verificação `24h`, redefinição `1h` | `EMAIL_TOKEN_SECRET`, `STOREFRONT_URL` | [`ADR-0015`](./adr/0015-email-transporte-tokens-assinados-e-mailpit.md) |
| **Rate limiting** | Login cliente: 5/15m por conta, 20/15m por IP; Staff: 5/15m conta, 15/15m IP; Cadastro: 10/60m IP; Forgot/Resend: 3/15m conta, 15/15m IP; backoff progressivo | `TRUST_PROXY` | Porta `RateLimiter` (`InMemoryRateLimiter`) |
| **Cabeçalhos HTTP** | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `CSP: default-src 'none'`, `HSTS` com `COOKIE_SECURE=true`, `Cache-Control: no-store` em `/me`, `/auth/*`, `/admin/*` | `COOKIE_SECURE` | `@fastify/helmet@13.2.0` |

---

## 3. Checklist de Segurança (Verificado)

- [x] **Cookies:** `HttpOnly`, `SameSite=Lax`, `Path=/`, sem `Domain`, prefixo `__Host-` + `Secure` quando `COOKIE_SECURE=true`, cookies distintos para storefront e backoffice (`identity-base.test.ts`, `security-matrix.integration.spec.ts`, `staff-rbac.integration.spec.ts`).
- [x] **CSRF:** validação de `Origin` em toda mutação (incluindo favoritos da Fase 2) + `x-csrf-token` atrelado à sessão em toda mutação autenticada, rejeitando token ausente ou de outra sessão (`security-matrix.integration.spec.ts`, `favorites-merge.integration.spec.ts`).
- [x] **Limite de tentativas:** `429 RATE_LIMITED` com `Retry-After` e atraso progressivo sem bloqueio permanente (`identity-base.test.ts`, `security-matrix.integration.spec.ts`).
- [x] **Anti-enumeração:** respostas idênticas para existente e inexistente em cadastro (`202`), login (`401 INVALID_CREDENTIALS` com hash fantasma), esqueci-a-senha (`202`) e reenvio de verificação (`202`) (`customer-auth.integration.spec.ts`, `email-flows.integration.spec.ts`, `security-matrix.integration.spec.ts`).
- [x] **RBAC e Posse:** negar-por-padrão verificado por scanner de rotas em `/admin/*`; matriz de papéis (`admin`, `catalog_manager`, `support`); IDOR em endereços retorna `404`; favoritos isolados entre clientes (`staff-rbac.integration.spec.ts`, `customer-profile.integration.spec.ts`, `favorites-merge.integration.spec.ts`).
- [x] **Cabeçalhos e Cache:** Helmet ativo, `x-powered-by`/`server` removidos, `Cache-Control: no-store` em `/me`, `/auth/*` e `/admin/*` (`security-matrix.integration.spec.ts`).
- [x] **Logs e Auditoria:** redação central de senhas, tokens, cookies, cabeçalhos `Authorization` e hashes testada com dados sentinela tanto no stream real do Pino quanto em `platform.audit_log`, e rollback atômico verificado (`identity-base.test.ts`, `audit-log.integration.spec.ts`, `security-matrix.integration.spec.ts`).
- [x] **Segredos e Boot de Produção:** segredos fora do Git; boot falha em `NODE_ENV=production` se `COOKIE_SECURE=false`, se segredos/admin estiverem vazios ou nos valores de exemplo, ou se `MAIL_TRANSPORT=memory` (`identity-base.test.ts`).
- [x] **Dependências (`pnpm audit` em 2026-11-23):**
  - `packages/email`: **0 vulnerabilidades**.
  - `packages/contracts`: **1 high** (`zod <4.6.6`, `GHSA-mrhx-c7xc-m3w5` — requer migração major para Zod v4; mitigado pelos limites estritos de tamanho em todos os schemas).
  - `apps/api`: **17 vulnerabilidades** (`1 low | 4 moderate | 9 high | 3 critical`, sendo os alertas críticos provenientes de `handlebars` dentro da devDependency `eslint-plugin-boundaries`, sem impacto em runtime de produção, além de `zod <4.6.6`).
  - Etapa não-bloqueante de `pnpm audit` adicionada ao workflow `.github/workflows/backend.yml` para monitoramento contínuo.

---

## 4. Limites Conhecidos e Evoluções Futuras (Fora de Escopo na Fase 5)

- **Sem 2FA / TOTP** (especialmente desejável para contas `staff` em fases futuras).
- **Sem login social / OAuth / link mágico**.
- **Sem troca de e-mail** do cliente em `PATCH /me`.
- **Rate limiter em memória:** não compartilha contadores entre múltiplas réplicas horizontais da API; a porta `RateLimiter` já permite plugar um adaptador Redis sem alterar os casos de uso.
- **LGPD (exclusão e exportação de dados do titular):** fora de escopo nesta fase; deverá ser implementada em fase dedicada com fluxo de anonimização/exclusão preservando integridade fiscal de pedidos futuros.
