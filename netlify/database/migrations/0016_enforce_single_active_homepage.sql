CREATE UNIQUE INDEX "pages_website_active_homepage_unique"
ON "pages" USING btree ("website_id")
WHERE "pages"."is_homepage" = true AND "pages"."status" <> 'archived';
