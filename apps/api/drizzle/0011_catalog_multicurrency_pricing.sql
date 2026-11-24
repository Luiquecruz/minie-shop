CREATE TABLE IF NOT EXISTS "catalog"."product_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"currency" varchar(3) NOT NULL,
	"regular_price_cents" integer NOT NULL,
	"special_price_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_prices_currency_valid" CHECK ("currency" IN ('USD', 'EUR')),
	CONSTRAINT "product_prices_regular_non_negative" CHECK ("regular_price_cents" >= 0),
	CONSTRAINT "product_prices_special_valid" CHECK ("special_price_cents" IS NULL OR ("special_price_cents" >= 0 AND "special_price_cents" <= "regular_price_cents"))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "catalog"."product_prices" ADD CONSTRAINT "product_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_prices_product_currency_uidx" ON "catalog"."product_prices" USING btree ("product_id","currency");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_prices_currency_idx" ON "catalog"."product_prices" USING btree ("currency");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalog"."exchange_rates" (
	"currency" varchar(3) PRIMARY KEY NOT NULL,
	"rate_from_brl" numeric(12, 6) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rates_currency_valid" CHECK ("currency" IN ('BRL', 'USD', 'EUR')),
	CONSTRAINT "exchange_rates_positive" CHECK ("rate_from_brl" > 0)
);
--> statement-breakpoint
INSERT INTO "catalog"."exchange_rates" ("currency", "rate_from_brl")
VALUES
	('BRL', '1.000000'),
	('USD', '0.200000'),
	('EUR', '0.185000')
ON CONFLICT ("currency") DO NOTHING;
--> statement-breakpoint
-- Normalize any pre-existing non-BRL base products: preserve their original USD/EUR
-- price in catalog.product_prices and convert their base column to BRL before
-- enforcing the BRL-only base-price invariant.
DO $$
DECLARE
  unsupported_count integer;
BEGIN
  SELECT COUNT(*) INTO unsupported_count
  FROM "catalog"."products"
  WHERE "currency" NOT IN ('BRL', 'USD', 'EUR');

  IF unsupported_count > 0 THEN
    RAISE EXCEPTION 'Cannot normalize catalog.products rows with unsupported currency codes';
  END IF;

  INSERT INTO "catalog"."product_prices" (
    "product_id",
    "currency",
    "regular_price_cents",
    "special_price_cents"
  )
  SELECT
    p."id",
    p."currency",
    p."regular_price_cents",
    p."special_price_cents"
  FROM "catalog"."products" AS p
  WHERE p."currency" IN ('USD', 'EUR')
  ON CONFLICT ("product_id", "currency") DO NOTHING;

  WITH updated_products AS (
    UPDATE "catalog"."products" AS p
    SET
      "regular_price_cents" = ROUND((p."regular_price_cents")::numeric / er."rate_from_brl")::integer,
      "special_price_cents" = CASE
        WHEN p."special_price_cents" IS NULL THEN NULL
        ELSE ROUND((p."special_price_cents")::numeric / er."rate_from_brl")::integer
      END,
      "currency" = 'BRL',
      "updated_at" = now()
    FROM "catalog"."exchange_rates" AS er
    WHERE p."currency" IN ('USD', 'EUR')
      AND er."currency" = p."currency"
    RETURNING p."id"
  )
  INSERT INTO "platform"."outbox" (
    "event_type",
    "consumer",
    "aggregate_type",
    "aggregate_id",
    "payload"
  )
  SELECT
    'product.changed',
    consumer_name,
    'product',
    up."id"::text,
    jsonb_build_object('productId', up."id"::text)
  FROM updated_products AS up
  CROSS JOIN (VALUES ('search-index'), ('recommendations')) AS c(consumer_name);
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "catalog"."products" ADD CONSTRAINT "products_base_currency_brl" CHECK ("currency" = 'BRL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
