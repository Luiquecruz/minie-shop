CREATE TABLE "identity"."customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "full_name" text NOT NULL,
  "email_verified_at" timestamptz,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "identity"."customer_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "identity"."customers"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "recipient_name" text NOT NULL,
  "street" text NOT NULL,
  "number" text NOT NULL,
  "complement" text,
  "neighborhood" text NOT NULL,
  "city" text NOT NULL,
  "state" varchar(2) NOT NULL,
  "postal_code" varchar(20) NOT NULL,
  "country" varchar(2) NOT NULL DEFAULT 'BR',
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "customer_addresses_customer_idx" ON "identity"."customer_addresses" ("customer_id");
--> statement-breakpoint
CREATE TABLE "identity"."staff_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "full_name" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "identity"."roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "identity"."permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "identity"."role_permissions" (
  "role_id" uuid NOT NULL REFERENCES "identity"."roles"("id") ON DELETE CASCADE,
  "permission_id" uuid NOT NULL REFERENCES "identity"."permissions"("id") ON DELETE CASCADE,
  PRIMARY KEY ("role_id", "permission_id")
);
--> statement-breakpoint
CREATE TABLE "identity"."staff_user_roles" (
  "staff_user_id" uuid NOT NULL REFERENCES "identity"."staff_users"("id") ON DELETE CASCADE,
  "role_id" uuid NOT NULL REFERENCES "identity"."roles"("id") ON DELETE CASCADE,
  PRIMARY KEY ("staff_user_id", "role_id")
);
--> statement-breakpoint
CREATE TABLE "identity"."sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "subject_type" text NOT NULL,
  "customer_id" uuid REFERENCES "identity"."customers"("id") ON DELETE CASCADE,
  "staff_user_id" uuid REFERENCES "identity"."staff_users"("id") ON DELETE CASCADE,
  "ip_address" text,
  "user_agent" text,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "sessions_subject_consistent" CHECK (
    ("subject_type" = 'customer' AND "customer_id" IS NOT NULL AND "staff_user_id" IS NULL)
    OR ("subject_type" = 'staff' AND "staff_user_id" IS NOT NULL AND "customer_id" IS NULL)
  )
);
--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "identity"."sessions" ("expires_at");
--> statement-breakpoint
CREATE TABLE "identity"."email_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "identity"."customers"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "purpose" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "email_tokens_purpose_valid" CHECK ("purpose" IN ('verify_email', 'reset_password'))
);
--> statement-breakpoint
CREATE INDEX "email_tokens_customer_idx" ON "identity"."email_tokens" ("customer_id");
