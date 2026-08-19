CREATE TYPE "public"."page_status" AS ENUM('draft', 'published', 'scheduled', 'archived');--> statement-breakpoint
CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"website_id" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"is_homepage" boolean DEFAULT false NOT NULL,
	"status" "page_status" DEFAULT 'draft' NOT NULL,
	"published_snapshot_id" text,
	"section_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"available_locales" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parent_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"created_by" text,
	"updated_by" text,
	"archived_at" timestamp with time zone,
	CONSTRAINT "pages_version_check" CHECK ("pages"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pages_website_active_slug_unique" ON "pages" USING btree ("website_id","slug") WHERE "pages"."status" <> 'archived';--> statement-breakpoint
CREATE INDEX "pages_website_id_idx" ON "pages" USING btree ("website_id");