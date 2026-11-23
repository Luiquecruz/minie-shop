CREATE TABLE "recommendations"."product_relations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "catalog"."products"("id") ON DELETE CASCADE,
  "related_product_id" uuid NOT NULL REFERENCES "catalog"."products"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "source" text NOT NULL,
  "method" text NOT NULL,
  "score" numeric(6, 5),
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "product_relations_no_self" CHECK ("product_id" <> "related_product_id"),
  CONSTRAINT "product_relations_type_valid" CHECK ("type" IN ('related', 'upsell', 'cross_sell')),
  CONSTRAINT "product_relations_source_valid" CHECK ("source" IN ('manual', 'auto')),
  CONSTRAINT "product_relations_method_valid" CHECK ("method" IN ('vector', 'rule', 'manual')),
  CONSTRAINT "product_relations_source_method_score_valid" CHECK (
    ("source" = 'manual' AND "method" = 'manual' AND "score" IS NULL)
    OR ("source" = 'auto' AND "method" IN ('vector', 'rule') AND "score" IS NOT NULL)
  ),
  CONSTRAINT "product_relations_position_non_negative" CHECK ("position" >= 0),
  CONSTRAINT "product_relations_unique_triple" UNIQUE ("product_id", "related_product_id", "type")
);
--> statement-breakpoint
CREATE INDEX "product_relations_lookup_idx"
  ON "recommendations"."product_relations" ("product_id", "type", "position");
--> statement-breakpoint
CREATE INDEX "product_relations_reverse_idx"
  ON "recommendations"."product_relations" ("related_product_id");
--> statement-breakpoint
CREATE TABLE "recommendations"."category_complements" (
  "category_id" uuid NOT NULL REFERENCES "catalog"."categories"("id") ON DELETE CASCADE,
  "complement_category_id" uuid NOT NULL REFERENCES "catalog"."categories"("id") ON DELETE CASCADE,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "category_complements_pk" PRIMARY KEY ("category_id", "complement_category_id"),
  CONSTRAINT "category_complements_no_self" CHECK ("category_id" <> "complement_category_id"),
  CONSTRAINT "category_complements_position_non_negative" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE INDEX "category_complements_category_pos_idx"
  ON "recommendations"."category_complements" ("category_id", "position");
