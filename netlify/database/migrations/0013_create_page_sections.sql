CREATE TABLE "page_sections" (
  "id" text PRIMARY KEY NOT NULL,
  "page_id" text NOT NULL,
  "website_id" text NOT NULL,
  "section_type_id" text NOT NULL,
  "sort_order" integer NOT NULL,
  "props" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "created_by" text,
  "updated_by" text,
  CONSTRAINT "page_sections_order_check" CHECK ("page_sections"."sort_order" >= 0),
  CONSTRAINT "page_sections_status_check" CHECK ("page_sections"."status" IN ('active', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "page_sections_page_order_unique" ON "page_sections" USING btree ("page_id", "sort_order");
--> statement-breakpoint
CREATE INDEX "page_sections_page_id_idx" ON "page_sections" USING btree ("page_id");
