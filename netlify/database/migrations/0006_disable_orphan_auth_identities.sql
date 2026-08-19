-- Adds provider-neutral identity disable state used after linkage retry exhaustion.
-- Forward-only: previously applied auth and linkage migrations remain unchanged.

ALTER TABLE "ba_user"
  ADD COLUMN IF NOT EXISTS "disabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "disabled_at" timestamptz;

CREATE INDEX IF NOT EXISTS "ba_user_disabled_idx" ON "ba_user" ("disabled") WHERE "disabled" = true;

ALTER TABLE "ba_account" ADD COLUMN IF NOT EXISTS "issuer" text;
UPDATE "ba_account" SET "issuer" = 'local:' || "provider_id" WHERE "issuer" IS NULL;
ALTER TABLE "ba_account" ALTER COLUMN "issuer" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ba_account_issuer_account_idx" ON "ba_account" ("issuer", "account_id");
