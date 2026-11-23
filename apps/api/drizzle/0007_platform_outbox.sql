CREATE TABLE "platform"."outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_type" text NOT NULL,
  "consumer" text NOT NULL,
  "aggregate_type" text NOT NULL,
  "aggregate_id" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "available_at" timestamptz NOT NULL DEFAULT now(),
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "locked_until" timestamptz,
  "processed_at" timestamptz,
  "status" text NOT NULL DEFAULT 'pending',
  CONSTRAINT "outbox_status_valid" CHECK ("status" IN ('pending', 'processed', 'dead')),
  CONSTRAINT "outbox_attempts_non_negative" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE INDEX "outbox_polling_idx" ON "platform"."outbox" ("status", "available_at", "id");
