ALTER TABLE "platform_super_admins" ADD COLUMN "singleton_key" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_super_admins" ADD CONSTRAINT "platform_super_admins_singleton_key_unique" UNIQUE("singleton_key");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_check" CHECK ("memberships"."role" IN ('owner', 'admin', 'editor', 'viewer'));--> statement-breakpoint
ALTER TABLE "platform_super_admins" ADD CONSTRAINT "platform_super_admins_singleton_check" CHECK ("platform_super_admins"."singleton_key" = 1);