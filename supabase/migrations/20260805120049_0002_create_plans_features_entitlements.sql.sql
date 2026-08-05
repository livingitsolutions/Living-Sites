/*
# Create plans, features, and plan_feature_entitlements tables

1. Purpose
   Platform-global subscription plans and feature catalog. Plans define
   commercial tiers (FREE, LIFETIME). Features are discrete capabilities
   (website limit, custom domain, export, page builder, forms, SEO,
   analytics). Entitlements associate a Feature with a Plan and store
   the granted value (boolean 1/0 or numeric limit).

2. New Tables
   - `plans`
     - `id` text PRIMARY KEY — stable plan identifier (e.g. "plan_free")
     - `tier` plan_tier NOT NULL — enum: starter, pro, business, enterprise
     - `slug` text NOT NULL UNIQUE — machine-readable key
     - `name` text NOT NULL — display name
     - `description` text — optional description
     - `price_monthly` integer NOT NULL DEFAULT 0 — cents
     - `price_annual` integer NOT NULL DEFAULT 0 — cents
     - `currency` text NOT NULL DEFAULT 'usd' — ISO 4217 lowercase
     - `max_websites` integer — null = unlimited
     - `max_members` integer — null = unlimited
     - `custom_domains_allowed` boolean NOT NULL DEFAULT false
     - `is_active` boolean NOT NULL DEFAULT true — active/deactivated state
     - `version` integer NOT NULL DEFAULT 1 — aggregate version
     - `created_at` timestamptz NOT NULL DEFAULT now()
     - `updated_at` timestamptz NOT NULL DEFAULT now()
     - `created_by` text
     - `updated_by` text
     - `deactivated_at` timestamptz — soft-deactivation timestamp

   - `features`
     - `id` text PRIMARY KEY — stable feature identifier (e.g. "feat_website_limit")
     - `key` text NOT NULL UNIQUE — stable machine key
     - `category` feature_category NOT NULL — enum: limit, capability, addon
     - `name` text NOT NULL — display name
     - `description` text — optional description
     - `value_type` text NOT NULL DEFAULT 'boolean' — 'boolean' | 'number'
     - `is_active` boolean NOT NULL DEFAULT true
     - `version` integer NOT NULL DEFAULT 1 — aggregate version
     - `created_at` timestamptz NOT NULL DEFAULT now()
     - `updated_at` timestamptz NOT NULL DEFAULT now()
     - `created_by` text
     - `updated_by` text

   - `plan_feature_entitlements`
     - `id` text PRIMARY KEY — stable identifier
     - `plan_id` text NOT NULL REFERENCES plans(id) ON DELETE CASCADE
     - `feature_id` text NOT NULL REFERENCES features(id) ON DELETE CASCADE
     - `value` numeric NOT NULL DEFAULT 0 — boolean 1/0 or numeric limit
     - `created_at` timestamptz NOT NULL DEFAULT now()
     - `updated_at` timestamptz NOT NULL DEFAULT now()
     - UNIQUE(plan_id, feature_id)

3. Indexes
   - plans: unique on slug
   - features: unique on key
   - plan_feature_entitlements: unique on (plan_id, feature_id), index on plan_id

4. Enums
   - `plan_tier`: starter, pro, business, enterprise
   - `feature_category`: limit, capability, addon

5. Security
   - RLS enabled on all three tables.
   - Plans and features are platform-global reference data. The application
     accesses them through the service role / internal connections, not
     through the anon-key frontend. No anon policies are created — these
     tables are not directly accessible from the browser.
   - No policies added: access is server-side only. RLS defaults to deny,
     which is correct for reference data that should never be exposed to
     the anon key.

6. Notes
   - All migrations are additive and forward-only. No destructive operations.
   - Entitlements use ON DELETE CASCADE so removing a plan or feature
     cleans up dangling entitlements automatically.
   - `value` is numeric to support both boolean (1/0) and numeric limits.
*/
CREATE TYPE "plan_tier" AS ENUM('starter', 'pro', 'business', 'enterprise');

CREATE TYPE "feature_category" AS ENUM('limit', 'capability', 'addon');

CREATE TABLE IF NOT EXISTS "plans" (
  "id" text PRIMARY KEY NOT NULL,
  "tier" "plan_tier" NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price_monthly" integer NOT NULL DEFAULT 0,
  "price_annual" integer NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'usd',
  "max_websites" integer,
  "max_members" integer,
  "custom_domains_allowed" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by" text,
  "updated_by" text,
  "deactivated_at" timestamp with time zone,
  CONSTRAINT "plans_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "features" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "category" "feature_category" NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "value_type" text NOT NULL DEFAULT 'boolean',
  "is_active" boolean NOT NULL DEFAULT true,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by" text,
  "updated_by" text,
  CONSTRAINT "features_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "plan_feature_entitlements" (
  "id" text PRIMARY KEY NOT NULL,
  "plan_id" text NOT NULL REFERENCES "plans"("id") ON DELETE CASCADE,
  "feature_id" text NOT NULL REFERENCES "features"("id") ON DELETE CASCADE,
  "value" numeric NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "plan_feature_entitlements_plan_feature_unique" UNIQUE("plan_id", "feature_id")
);

CREATE INDEX IF NOT EXISTS "plan_feature_entitlements_plan_id_idx" ON "plan_feature_entitlements"("plan_id");
CREATE INDEX IF NOT EXISTS "plan_feature_entitlements_feature_id_idx" ON "plan_feature_entitlements"("feature_id");

ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "features" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_feature_entitlements" ENABLE ROW LEVEL SECURITY;
