-- 0008_create_memberships.sql
-- Membership persistence schema and platform super admin store.

DO $$ BEGIN
  CREATE TYPE "membership_status" AS ENUM ('active', 'archived', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "memberships" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "platform_users"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "website_scope_id" text,
  "status" "membership_status" NOT NULL DEFAULT 'active',
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "created_by" text,
  "updated_by" text,
  "deleted_at" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "memberships_org_user_orgwide_unique"
  ON "memberships" ("organization_id", "user_id")
  WHERE "website_scope_id" IS NULL AND "status" = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS "memberships_org_user_website_unique"
  ON "memberships" ("organization_id", "user_id", "website_scope_id")
  WHERE "website_scope_id" IS NOT NULL AND "status" = 'active';

CREATE INDEX IF NOT EXISTS "memberships_org_role_status_idx"
  ON "memberships" ("organization_id", "role", "status");

CREATE INDEX IF NOT EXISTS "memberships_user_status_idx"
  ON "memberships" ("user_id", "status");

CREATE TABLE IF NOT EXISTS "platform_super_admins" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL UNIQUE REFERENCES "platform_users"("id") ON DELETE CASCADE,
  "email" text NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" text
);
