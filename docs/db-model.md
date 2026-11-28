# Database Model (`PostgreSQL 17 + pgvector`)

Relational data model for **Progressive Minie Shop** running on PostgreSQL 17 (`pgvector/pgvector:pg17`), organized with **one PostgreSQL schema per domain module** per [`ADR-0006`](./adr/0006-organizacao-banco-schemas-por-modulo.md) and statically enforced by per-schema ESLint boundaries in `apps/api/eslint.config.mjs` (`ADR-0023`).

---

## 1. Schemas & Extensions

- **Extensions (migration `0000`):** `pgcrypto`, `vector` (`pgvector`), `unaccent`.
- **Module-Owned Schemas:**
  - `catalog` — category hierarchy, products, product variants, attribute definitions, product image links (exclusively written by `CatalogService`), product embeddings (`pgvector` 768-dim, `ADR-0011` / `ADR-0022`), and favorites.
  - `media` — object-storage asset metadata and generated WebP variant descriptors (binary bytes live in SeaweedFS/S3, never in PostgreSQL).
  - `inventory` — physical stock quantities and reservations per product variant.
  - `identity` — customers, customer addresses, opaque sessions, signed email tokens, staff users, roles, and RBAC permissions (`ADR-0007`, `ADR-0014`, `ADR-0015`).
  - `platform` — store settings, immutable audit trail (`platform.audit_log`), and transactional outbox (`platform.outbox_events`, `ADR-0012`).
  - `recommendations` — pre-computed product relations (`recommendations.product_relations`) and complementary category map (`recommendations.category_complements`, `ADR-0013`).

---

## 2. Entity-Relationship Diagrams by Module

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
    text status
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

  catalog_product_embeddings {
    uuid product_id PK, FK
    text model
    text content_hash
    vector embedding
    timestamptz updated_at
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
  catalog_products ||--o| catalog_product_embeddings : product_id
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
    text phone
    timestamptz email_verified_at
    boolean is_active
  }

  identity_customer_addresses {
    uuid id PK
    uuid customer_id FK
    text label
    text phone
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
    timestamptz last_seen_at
    timestamptz expires_at
    timestamptz absolute_expires_at
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
    jsonb before_state
    jsonb after_state
    text ip_address
    text user_agent
    text request_id
    jsonb metadata
  }

  platform_outbox_events {
    uuid id PK
    text event_type
    text consumer
    jsonb payload
    text status
    int attempts
    timestamptz next_attempt_at
    timestamptz locked_until
    timestamptz processed_at
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

### `recommendations`

```mermaid
erDiagram
  recommendations_product_relations {
    uuid id PK
    uuid product_id FK
    uuid related_product_id FK
    text type
    text source
    text method
    numeric score
    int position
    timestamptz created_at
    timestamptz updated_at
  }

  recommendations_category_complements {
    uuid category_id PK, FK
    uuid complement_category_id PK, FK
    int position
    timestamptz created_at
    timestamptz updated_at
  }

  catalog_products ||--o{ recommendations_product_relations : product_id
  catalog_products ||--o{ recommendations_product_relations : related_product_id
  catalog_categories ||--o{ recommendations_category_complements : category_id
  catalog_categories ||--o{ recommendations_category_complements : complement_category_id
```

---

## 3. Key Constraints & Indexes

- **Pricing (integer cents):** `regular_price_cents >= 0`, `special_price_cents IS NULL OR (special_price_cents >= 0 AND special_price_cents <= regular_price_cents)`, `product_variants.price_cents IS NULL OR price_cents >= 0`.
- **Inventory (`inventory.stock_items`):** `quantity >= 0`, `reserved >= 0`, `reserved <= quantity`, `variant_id UNIQUE`.
- **Media (`media.media_assets`):** `status IN ('pending', 'ready', 'failed')`, `storage_key UNIQUE`, `checksum_sha256 UNIQUE`, `size_bytes > 0`. Product image association writes live exclusively in `CatalogService.linkProductImage` (`catalog.product_images`).
- **Catalog Search & Embeddings (`catalog.products`, `catalog.product_embeddings`):**
  - `status IN ('draft', 'published', 'archived')` (`products_status_idx`) and `CHECK (slug <> 'facets')` (`ADR-0008`).
  - `search_vector` (`tsvector`) maintained via `BEFORE INSERT OR UPDATE` trigger using `to_tsvector('portuguese', public.unaccent(...))` with weights `A` (`name`) and `B` (`description`), indexed with **GIN**.
  - `attributes` (`jsonb`) indexed with **GIN**; B-tree indexes on `category_id`, `regular_price_cents`, and `special_price_cents`.
  - `catalog.product_embeddings` stores 768-dimensional vectors generated by `embeddinggemma-2` (`ADR-0022`) with HNSW `vector_cosine_ops` index and `content_hash` idempotency guard.
- **Favorites (`catalog.favorites`):** Requires `customer_id IS NOT NULL OR session_id IS NOT NULL`, with partial unique indexes on `(customer_id, product_id)` and `(session_id, product_id)`.
- **Recommendations (`recommendations.product_relations`, `recommendations.category_complements`):**
  - `product_relations`: `product_id <> related_product_id`, `UNIQUE (product_id, related_product_id, type)`, `type IN ('related', 'upsell', 'cross_sell')`, `source IN ('manual', 'auto')`, `method IN ('vector', 'rule', 'manual')`, manual/auto score invariants, `position >= 0`, `ON DELETE CASCADE` FKs to `catalog.products(id)`.
  - `category_complements`: `PRIMARY KEY (category_id, complement_category_id)`, `category_id <> complement_category_id`, `position >= 0`, `ON DELETE CASCADE` FKs to `catalog.categories(id)`.
- **Identity, Sessions & Audit (`identity.*`, `platform.audit_log`, `platform.outbox_events`):**
  - Partial unique index `customer_addresses_default_uidx (customer_id) WHERE is_default = true`.
  - Dual expiration (`expires_at` idle + `absolute_expires_at` hard cap) and `last_seen_at` on `identity.sessions`.
  - Structured `before_state`, `after_state`, `ip_address`, `user_agent`, and `request_id` columns on `platform.audit_log`.
  - `platform.outbox_events` polled with `SELECT ... FOR UPDATE SKIP LOCKED` and per-consumer rows (`ADR-0012`).
- **Cross-Schema FKs:** Strictly reference primary keys (`id`) of owning tables only (`ADR-0006`).
