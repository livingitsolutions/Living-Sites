CREATE TABLE "plan_feature_entitlements" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL REFERENCES "plans"("id") ON DELETE CASCADE,
	"feature_id" text NOT NULL REFERENCES "features"("id") ON DELETE CASCADE,
	"value" numeric DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_feature_entitlements_plan_feature_unique" UNIQUE("plan_id", "feature_id")
);
