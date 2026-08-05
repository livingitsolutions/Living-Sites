CREATE TABLE "features" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"category" "feature_category" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"value_type" text DEFAULT 'boolean' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "features_key_unique" UNIQUE("key")
);
