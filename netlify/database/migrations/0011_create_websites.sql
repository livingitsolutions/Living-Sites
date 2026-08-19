CREATE TYPE "public"."website_status" AS ENUM('draft', 'published', 'unpublished', 'archived');--> statement-breakpoint
CREATE TABLE "websites" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"custom_domain" text,
	"fallback_domain" text NOT NULL,
	"status" "website_status" DEFAULT 'draft' NOT NULL,
	"theme_id" text,
	"published_release_label" text,
	"default_locale" text DEFAULT 'en-US' NOT NULL,
	"enabled_locales" jsonb DEFAULT '["en-US"]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"created_by" text,
	"updated_by" text,
	"archived_at" timestamp with time zone,
	CONSTRAINT "websites_version_check" CHECK ("websites"."version" >= 1),
	CONSTRAINT "websites_custom_domain_lowercase_check" CHECK ("websites"."custom_domain" IS NULL OR "websites"."custom_domain" = lower("websites"."custom_domain")),
	CONSTRAINT "websites_fallback_domain_lowercase_check" CHECK ("websites"."fallback_domain" = lower("websites"."fallback_domain"))
);
--> statement-breakpoint
ALTER TABLE "websites" ADD CONSTRAINT "websites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "websites_organization_slug_unique" ON "websites" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "websites_custom_domain_unique" ON "websites" USING btree ("custom_domain") WHERE "websites"."custom_domain" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "websites_fallback_domain_unique" ON "websites" USING btree ("fallback_domain");--> statement-breakpoint
CREATE INDEX "websites_organization_id_idx" ON "websites" USING btree ("organization_id");