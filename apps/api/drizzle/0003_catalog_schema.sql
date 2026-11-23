CREATE TABLE "catalog"."categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "parent_id" uuid REFERENCES "catalog"."categories"("id") ON DELETE SET NULL,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "catalog"."categories" ("parent_id");
--> statement-breakpoint
CREATE TABLE "catalog"."attribute_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL UNIQUE,
  "label" text NOT NULL,
  "data_type" text NOT NULL,
  "unit" text,
  "is_filterable" boolean NOT NULL DEFAULT false,
  "show_on_card" boolean NOT NULL DEFAULT false,
  "icon_key" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "attribute_definitions_data_type_valid" CHECK ("data_type" IN ('string', 'number', 'boolean', 'enum'))
);
--> statement-breakpoint
CREATE TABLE "catalog"."products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid NOT NULL REFERENCES "catalog"."categories"("id") ON DELETE RESTRICT,
  "slug" text NOT NULL UNIQUE,
  "sku" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "regular_price_cents" integer NOT NULL,
  "special_price_cents" integer,
  "currency" varchar(3) NOT NULL DEFAULT 'BRL',
  "in_stock" boolean NOT NULL DEFAULT false,
  "rating_average" numeric(3, 2) NOT NULL DEFAULT 0.00,
  "rating_count" integer NOT NULL DEFAULT 0,
  "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "search_vector" tsvector,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "products_regular_price_non_negative" CHECK ("regular_price_cents" >= 0),
  CONSTRAINT "products_special_price_valid" CHECK (
    "special_price_cents" IS NULL OR ("special_price_cents" >= 0 AND "special_price_cents" <= "regular_price_cents")
  ),
  CONSTRAINT "products_rating_count_non_negative" CHECK ("rating_count" >= 0)
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "catalog".products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', public.unaccent(coalesce(NEW.name, ''))), 'A') ||
    setweight(to_tsvector('portuguese', public.unaccent(coalesce(NEW.description, ''))), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER products_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, description
  ON "catalog"."products"
  FOR EACH ROW
  EXECUTE FUNCTION "catalog".products_search_vector_update();
--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "catalog"."products" ("category_id");
--> statement-breakpoint
CREATE INDEX "products_regular_price_idx" ON "catalog"."products" ("regular_price_cents");
--> statement-breakpoint
CREATE INDEX "products_special_price_idx" ON "catalog"."products" ("special_price_cents");
--> statement-breakpoint
CREATE INDEX "products_attributes_gin_idx" ON "catalog"."products" USING GIN ("attributes");
--> statement-breakpoint
CREATE INDEX "products_search_vector_gin_idx" ON "catalog"."products" USING GIN ("search_vector");
--> statement-breakpoint
CREATE TABLE "catalog"."product_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "catalog"."products"("id") ON DELETE CASCADE,
  "sku" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "price_cents" integer,
  "is_default" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "product_variants_price_non_negative" CHECK ("price_cents" IS NULL OR "price_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "catalog"."product_variants" ("product_id");
--> statement-breakpoint
CREATE TABLE "catalog"."product_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "catalog"."products"("id") ON DELETE CASCADE,
  "media_asset_id" uuid NOT NULL REFERENCES "media"."media_assets"("id") ON DELETE RESTRICT,
  "alt_text" text NOT NULL DEFAULT '',
  "position" integer NOT NULL DEFAULT 0,
  "is_primary" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "product_images_position_non_negative" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_product_media_uidx" ON "catalog"."product_images" ("product_id", "media_asset_id");
--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "catalog"."product_images" ("product_id");
--> statement-breakpoint
CREATE TABLE "catalog"."favorites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "catalog"."products"("id") ON DELETE CASCADE,
  "customer_id" uuid REFERENCES "identity"."customers"("id") ON DELETE CASCADE,
  "session_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "favorites_owner_present" CHECK ("customer_id" IS NOT NULL OR "session_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_customer_product_uidx"
  ON "catalog"."favorites" ("customer_id", "product_id")
  WHERE "customer_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_session_product_uidx"
  ON "catalog"."favorites" ("session_id", "product_id")
  WHERE "session_id" IS NOT NULL;
