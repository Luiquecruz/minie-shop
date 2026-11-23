-- Phase 5 (Identity & Staff Audit) schema additions
-- Preserves all existing T07 columns and constraints; adds only missing fields and indexes.

ALTER TABLE "identity"."customers"
  ADD COLUMN IF NOT EXISTS "phone" text;
--> statement-breakpoint

ALTER TABLE "identity"."customer_addresses"
  ADD COLUMN IF NOT EXISTS "phone" text;
--> statement-breakpoint

ALTER TABLE "identity"."customer_addresses"
  ALTER COLUMN "label" DROP NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "customer_addresses_default_uidx"
  ON "identity"."customer_addresses" ("customer_id")
  WHERE "is_default" = true;
--> statement-breakpoint

ALTER TABLE "identity"."sessions"
  ADD COLUMN IF NOT EXISTS "last_seen_at" timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint

ALTER TABLE "identity"."sessions"
  ADD COLUMN IF NOT EXISTS "absolute_expires_at" timestamptz NOT NULL DEFAULT (now() + interval '30 days');
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sessions_customer_idx"
  ON "identity"."sessions" ("customer_id")
  WHERE "customer_id" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sessions_staff_user_idx"
  ON "identity"."sessions" ("staff_user_id")
  WHERE "staff_user_id" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sessions_absolute_expires_idx"
  ON "identity"."sessions" ("absolute_expires_at");
--> statement-breakpoint

ALTER TABLE "platform"."audit_log"
  ADD COLUMN IF NOT EXISTS "before_state" jsonb,
  ADD COLUMN IF NOT EXISTS "after_state" jsonb,
  ADD COLUMN IF NOT EXISTS "ip_address" text,
  ADD COLUMN IF NOT EXISTS "user_agent" text,
  ADD COLUMN IF NOT EXISTS "request_id" text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_log_actor_idx"
  ON "platform"."audit_log" ("actor_type", "actor_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_log_action_idx"
  ON "platform"."audit_log" ("action");
