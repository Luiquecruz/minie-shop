# Modelo de Banco de Dados (`T07`)

Documentação do modelo relacional do **Progressive Minie Shop** em PostgreSQL 17 (`pgvector/pgvector:pg17`), organizado com **um schema por módulo** conforme [`ADR-0006`](./adr/0006-organizacao-banco-schemas-por-modulo.md) e [`ADR-0007`](./adr/0007-autenticacao-sessoes-opacas-propria.md).

---

## 1. Schemas e Extensões

- **Extensões criadas na migration `0000`:** `pgcrypto`, `vector` (`pgvector`), `unaccent`.
- **Schemas:**
  - `catalog` — árvore de categorias, produtos, variantes, definições de atributos, imagens de produto e favoritos.
  - `media` — metadados de ativos de mídia no object storage (bytes nunca vão para o banco).
  - `inventory` — controle de estoque físico e reservas por variante.
  - `identity` — tabelas de clientes, endereços, sessões opacas, tokens de e-mail, staff e RBAC (implementação de auth fica para fase posterior).
  - `platform` — configurações da loja e trilha de auditoria.
  - `recommendations` — schema reservado para fases futuras (sem tabelas na Fase 1; `product_embeddings` e `outbox` ficam fora da Fase 1).

---

## 2. Diagrama ER por Módulo

### `catalog` + `media` + `inventory`

```mermaid
erDiagram
  catalog_categories {
    uuid id PK
    uuid parent_id FK
    text slug UK
    text name
    int sort_order
  }

  catalog_products {
    uuid id PK
    uuid category_id FK
    text slug UK
    text sku UK
    text name
    int regular_price_cents
    int special_price_cents
    varchar currency
    boolean in_stock
    jsonb attributes
    tsvector search_vector
  }

  catalog_product_variants {
    uuid id PK
    uuid product_id FK
    text sku UK
    text name
    jsonb attributes
    int price_cents
    boolean is_default
  }

  catalog_attribute_definitions {
    uuid id PK
    text code UK
    text label
    text data_type
    text unit
    boolean is_filterable
    boolean show_on_card
    text icon_key
  }

  catalog_product_images {
    uuid id PK
    uuid product_id FK
    uuid media_asset_id FK
    text alt_text
    int position
    boolean is_primary
  }

  catalog_favorites {
    uuid id PK
    uuid product_id FK
    uuid customer_id FK
    text session_id
  }

  media_media_assets {
    uuid id PK
    text storage_key UK
    text bucket
    text mime_type
    int size_bytes
    int width
    int height
    text checksum_sha256 UK
    text placeholder_base64
    jsonb variants
    text status
  }

  inventory_stock_items {
    uuid id PK
    uuid variant_id FK
    int quantity
    int reserved
  }

  catalog_categories ||--o{ catalog_categories : parent_id
  catalog_categories ||--o{ catalog_products : category_id
  catalog_products ||--|{ catalog_product_variants : product_id
  catalog_products ||--o{ catalog_product_images : product_id
  media_media_assets ||--o{ catalog_product_images : media_asset_id
  catalog_products ||--o{ catalog_favorites : product_id
  catalog_product_variants ||--|| inventory_stock_items : variant_id
```

### `identity` + `platform`

```mermaid
erDiagram
  identity_customers {
    uuid id PK
    text email UK
    text password_hash
    text full_name
    timestamptz email_verified_at
    boolean is_active
  }

  identity_customer_addresses {
    uuid id PK
    uuid customer_id FK
    text label
    text city
    varchar state
    varchar postal_code
    boolean is_default
  }

  identity_staff_users {
    uuid id PK
    text email UK
    text password_hash
    text full_name
    boolean is_active
  }

  identity_roles {
    uuid id PK
    text code UK
    text name
  }

  identity_permissions {
    uuid id PK
    text code UK
    text name
  }

  identity_role_permissions {
    uuid role_id PK
    uuid permission_id PK
  }

  identity_staff_user_roles {
    uuid staff_user_id PK
    uuid role_id PK
  }

  identity_sessions {
    uuid id PK
    text token_hash UK
    text subject_type
    uuid customer_id FK
    uuid staff_user_id FK
    timestamptz expires_at
    timestamptz revoked_at
  }

  identity_email_tokens {
    uuid id PK
    uuid customer_id FK
    text token_hash UK
    text purpose
    timestamptz expires_at
    timestamptz consumed_at
  }

  platform_store_settings {
    text key PK
    jsonb value
  }

  platform_audit_log {
    uuid id PK
    text actor_type
    uuid actor_id
    text action
    text entity_type
    text entity_id
    jsonb metadata
  }

  identity_customers ||--o{ identity_customer_addresses : customer_id
  identity_customers ||--o{ identity_sessions : customer_id
  identity_customers ||--o{ identity_email_tokens : customer_id
  identity_staff_users ||--o{ identity_sessions : staff_user_id
  identity_staff_users ||--o{ identity_staff_user_roles : staff_user_id
  identity_roles ||--o{ identity_staff_user_roles : role_id
  identity_roles ||--o{ identity_role_permissions : role_id
  identity_permissions ||--o{ identity_role_permissions : permission_id
```

---

## 3. Constraints e Índices Principais

- **Preços:** `regular_price_cents >= 0`, `special_price_cents IS NULL OR (special_price_cents >= 0 AND special_price_cents <= regular_price_cents)`, `product_variants.price_cents IS NULL OR price_cents >= 0`.
- **Estoque (`inventory.stock_items`):** `quantity >= 0`, `reserved >= 0`, `reserved <= quantity`, `variant_id UNIQUE`.
- **Mídia (`media.media_assets`):** `status IN ('pending', 'ready', 'failed')`, `storage_key UNIQUE`, `checksum_sha256 UNIQUE`, `size_bytes > 0`.
- **Busca textual e filtros (`catalog.products`):**
  - `search_vector` (`tsvector`) atualizado automaticamente via trigger `BEFORE INSERT OR UPDATE` usando `to_tsvector('portuguese', public.unaccent(...))` com pesos `A` (`name`) e `B` (`description`), indexado com **GIN**.
  - `attributes` (`jsonb`) indexado com **GIN**.
  - Índices B-tree em `category_id`, `regular_price_cents` e `special_price_cents`.
- **Favoritos (`catalog.favorites`):** exige `customer_id IS NOT NULL OR session_id IS NOT NULL`, com índices únicos parciais por `(customer_id, product_id)` e `(session_id, product_id)`.
- **FKs entre schemas:** apontam exclusivamente para a chave primária (`id`) da tabela dona (`ADR-0006`).
