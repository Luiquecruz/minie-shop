CREATE TABLE "inventory"."stock_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "variant_id" uuid NOT NULL UNIQUE REFERENCES "catalog"."product_variants"("id") ON DELETE CASCADE,
  "quantity" integer NOT NULL DEFAULT 0,
  "reserved" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "stock_items_quantity_non_negative" CHECK ("quantity" >= 0),
  CONSTRAINT "stock_items_reserved_non_negative" CHECK ("reserved" >= 0),
  CONSTRAINT "stock_items_reserved_lte_quantity" CHECK ("reserved" <= "quantity")
);
