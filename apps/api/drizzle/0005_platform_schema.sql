CREATE TABLE "platform"."store_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "description" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform"."audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_type" text NOT NULL,
  "actor_id" uuid,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "audit_log_actor_type_valid" CHECK ("actor_type" IN ('system', 'customer', 'staff'))
);
--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "platform"."audit_log" ("entity_type", "entity_id");
--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "platform"."audit_log" ("created_at");
