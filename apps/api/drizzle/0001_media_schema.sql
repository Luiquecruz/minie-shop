CREATE TABLE "media"."media_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "storage_key" text NOT NULL UNIQUE,
  "bucket" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "width" integer,
  "height" integer,
  "checksum_sha256" text NOT NULL UNIQUE,
  "placeholder_base64" text,
  "variants" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "media_assets_size_positive" CHECK ("size_bytes" > 0),
  CONSTRAINT "media_assets_dimensions_positive" CHECK (
    ("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0)
  ),
  CONSTRAINT "media_assets_status_valid" CHECK ("status" IN ('pending', 'ready', 'failed'))
);
