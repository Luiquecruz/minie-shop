ALTER TABLE "catalog"."products"
  ADD COLUMN "status" text NOT NULL DEFAULT 'published';
--> statement-breakpoint
ALTER TABLE "catalog"."products"
  ADD CONSTRAINT "products_status_valid" CHECK ("status" IN ('draft', 'published', 'archived'));
--> statement-breakpoint
ALTER TABLE "catalog"."products"
  ADD CONSTRAINT "products_slug_not_reserved" CHECK ("slug" <> 'facets');
--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "catalog"."products" ("status");
