# ADR-0007: Autenticação — Implementação Própria com Sessões Opacas no Servidor

- **Status:** Accepted
- **Date:** 2026-11-21
- **Phase:** Fase 1 — Fundação Backend (`T01`, ref. spec `ADR-009`)

## Contexto
O e-commerce precisa autenticar dois públicos distintos — **clientes do storefront** (`customers`, autorizados por posse de recursos) e **equipe do backoffice** (`staff_users`, autorizados por RBAC via `roles`, `permissions`, `role_permissions` e `staff_user_roles`) — dentro do schema `identity` definido na T07.

Requisitos obrigatórios:
- Sessões no servidor com **token opaco** armazenado apenas como **hash** no banco (revogação imediata).
- Cookies `HttpOnly`, `Secure` (em produção), `SameSite=Lax`, **separados** para storefront e backoffice.
- Senhas com **Argon2id**.
- Compatibilidade total com o schema `identity` (`customers`, `customer_addresses`, `sessions`, `email_tokens`, `staff_users`, `roles`, `permissions`, `role_permissions`, `staff_user_roles`) sem forçar tabelas/colunas proprietárias.
- Custo zero (100% open source, sem SaaS).

*Nota de escopo:* na Fase 1 (T07) são criadas apenas as tabelas do schema `identity`; a implementação dos fluxos de login/sessão ocorre em fase posterior.

## Decisão
- Adotar **implementação própria** de autenticação e sessões no módulo `identity` (seguindo o padrão recomendado após a descontinuação do Lucia v3):
  - **Hashing de senhas:** biblioteca nativa `argon2` configurada com `argon2id` (parâmetros OWASP).
  - **Sessões opacas:** geração de token aleatório criptograficamente seguro (`crypto.randomBytes(32)` codificado em base64url/hex), armazenando no banco apenas o hash **SHA-256** do token em `identity.sessions.token_hash`, com suporte a `subject_type` (`customer` | `staff`), `expires_at` e `revoked_at`.
  - **Cookies separados:** nomes e escopos distintos para storefront (ex.: `minieshop_customer_session`) e backoffice (ex.: `minieshop_staff_session`), ambos `HttpOnly`, evitando vazamento de sessão entre áreas.
  - **Autorização:** Guards/Decorators nativos do NestJS — verificação de posse (`customer_id`) para clientes e RBAC (`roles`/`permissions`) exclusivamente para `staff_users`.
  - **Tokens de e-mail:** `identity.email_tokens` armazenando hash de token com propósito (`verify_email`, `reset_password`), expiração e uso único (`consumed_at`).

## Alternativas Consideradas (Documentação Atual Consultada)
- **Lucia Auth v3:** oficialmente **descontinuada** como pacote npm; o próprio mantenedor passou a recomendar implementar a lógica enxuta de sessões opacas diretamente no código da aplicação (exatamente o padrão adotado aqui).
- **Better Auth:** biblioteca ativa, open source e com adaptador oficial para Drizzle (`@better-auth/drizzle-adapter`). Porém, impõe convenções próprias de schema (`user`, `session`, `account`, `verification`), centraliza um único modelo de usuário (dificultando a separação limpa entre `customers` e `staff_users` com cookies e RBAC distintos) e exige camada de adaptação extra para NestJS + Fastify. Forçaria compromissos no schema `identity`.
- **Passport.js (`@nestjs/passport`):** gerencia apenas estratégias de autenticação/extração de credenciais, não resolve sessões opacas com hash no PostgreSQL, cookies duplos ou RBAC customizado — adicionaria abstração sem eliminar o código de sessão.
- **Auth0 / Clerk / Keycloak:** Auth0/Clerk violam a regra de custo zero / sem SaaS; Keycloak adiciona serviço JVM pesado e complexidade operacional desproporcional para um monolito modular.
- **JWT stateless:** descartado por não permitir revogação imediata de sessões sem blocklist (o que acaba recriando estado no servidor).

## Consequências
### Positivas
- Aderência 100% ao schema `identity` da T07, sem tabelas extras ou acoplamento a adapters de terceiros.
- Código de sessão pequeno, auditável e testável, com revogação instantânea, `argon2id` e separação rígida entre storefront e backoffice.
- Zero dependência de fornecedor externo ou bibliotecas de auth sujeitas a breaking changes.

### Negativas / Trade-offs
- Responsabilidade direta pela implementação segura de rotação de sessão, proteção CSRF (em conjunto com `SameSite`), rate limiting de login e expiração de `email_tokens` quando o módulo `identity` for ativado.
- Fluxos futuros como OAuth/social login precisarão ser integrados manualmente (ex.: via `arctic`) caso entrem no roadmap.
