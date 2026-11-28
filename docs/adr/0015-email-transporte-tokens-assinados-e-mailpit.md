# ADR-0015: E-mail Transacional — `packages/email`, Tokens Assinados, Outbox e Mailpit

- **Status:** Partially Superseded by [ADR-0023](./0023-monorepo-package-boundaries-stack-typescript-and-contracts.md) *(`@minieshop/email` extended with unit tests, ESLint, and shared `@minieshop/config` Node preset; signed token and outbox email flow unchanged)*
- **Date:** 2026-11-22
- **Phase:** Fase 5 — Identidade, Segurança e Auditoria (`I03`, ref. spec `ADR-012`)

---

## Contexto

Os fluxos de verificação de e-mail, redefinição de senha, aviso de senha alterada e aviso anti-enumeração ("você já tem uma conta") precisam enviar mensagens confiáveis em HTML e texto puro sem bloquear o ciclo HTTP, sem gravar segredos em filas/logs e mantendo custo zero em desenvolvimento local.

---

## Decisão

### 1. Tokens de E-mail Assinados (`<id>.<hmac>`) vs. Hash Aleatório Puro
- **Desvio deliberado em relação ao plano original:** em vez de gerar um token aleatório puro e precisar transportá-lo na fila de outbox (o que gravaria um segredo em `platform.outbox.payload`), adotamos o formato **`<id>.<assinatura HMAC-SHA256>`**:
  - `id` é a PK UUID de `identity.email_tokens`.
  - `assinatura = HMAC-SHA256(EMAIL_TOKEN_SECRET, "${id}:${purpose}:${customerId}:${expiresAt.toISOString()}")` em `base64url`.
  - `identity.email_tokens.token_hash` continua armazenando o `SHA-256` do token completo assinado (preservando a coluna e a constraint `UNIQUE` da T07).
- **Benefício:** o outbox transporta **apenas** `{ kind, customerId, emailTokenId }` (nenhum segredo na fila). O handler `mailer` lê o estado atual no banco, verifica que o token não foi consumido nem expirou e regenera o token assinado no momento do envio.
- **Validades e uso único:**
  - `verify_email`: **24 horas**, uso único (`consumed_at`).
  - `reset_password`: **1 hora**, uso único (`consumed_at`).
  - Emitir um novo token do mesmo propósito invalida (`consumed_at = now()`) tokens anteriores não usados daquele cliente.
  - Token adulterado, expirado ou reutilizado retorna o **mesmo** erro genérico `400 VALIDATION_ERROR ("Invalid or expired token")`.

### 2. Templates em `packages/email` (React Email)
- Pacote independente `@minieshop/email` ligado via `link:../../packages/email`, com `@react-email/components@1.0.12`, `@react-email/render@2.3.1` e `react@19.3.1`.
- Todos os 4 templates em `pt-BR` renderizam **HTML e texto puro** (`toPlainText(html)`).
- Links são construídos **exclusivamente** a partir de `STOREFRONT_URL` (nunca do cabeçalho `Host`).

### 3. Porta `MailTransport` e Adaptadores
- **`smtp` (`SmtpMailTransport` via `nodemailer@10.6.1`):** padrão em dev apontando para o serviço `mailpit` (`axllent/mailpit:v1.24.1`, portas `1025` SMTP e `8025` Web UI vinculadas somente a `127.0.0.1`, healthcheck `/mailpit readyz`).
- **`resend` (`ResendMailTransport` via HTTP `fetch`):** adaptador para produção; exige `RESEND_API_KEY` e `MAIL_FROM` no boot em `NODE_ENV=production`.
- **`memory` (`InMemoryMailTransport`):** adaptador em memória para testes automatizados e CI (proibido no boot de produção).

---

## Consequências

- **Positivas:** nenhum segredo transita pelo outbox; reenvios são resilientes via retry/backoff do outbox; e-mails obsoletos (conta já verificada ou token substituído) são descartados automaticamente pelo handler baseado em estado.
- **Negativas / Trade-offs:** a rotação de `EMAIL_TOKEN_SECRET` invalida tokens de e-mail pendentes (efeito esperado e aceitável dado o TTL curto de 1h–24h).
