CREATE TABLE "page_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"website_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"release_version" text,
	"page_metadata" jsonb NOT NULL,
	"sections" jsonb NOT NULL,
	"seo" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"published_by" text NOT NULL,
	CONSTRAINT "page_snapshots_revision_check" CHECK ("page_snapshots"."revision_number" >= 1)
);
--> statement-breakpoint
ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "page_snapshots_page_revision_unique" ON "page_snapshots" USING btree ("page_id","revision_number");--> statement-breakpoint
CREATE INDEX "page_snapshots_page_id_idx" ON "page_snapshots" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "page_snapshots_website_id_idx" ON "page_snapshots" USING btree ("website_id");