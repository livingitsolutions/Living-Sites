/**
 * Deterministic, idempotent seed for platform-global Plans and Features.
 *
 * Seeds are reference data, not migrations. Migrations define schema;
 * seeds populate data. Seeds must be run explicitly via a CLI command,
 * never automatically at application startup.
 *
 * Rerunning the seed must not create duplicates. All inserts use
 * ON CONFLICT DO NOTHING semantics via Drizzle's onConflict clause.
 * Seed data changes must be explicit and reviewable in this file.
 *
 * No hardcoded customer-specific data. The LIFETIME plan is representable
 * but no Tajon-specific organization data is created.
 */
import type { DrizzleDB } from "../db/drizzle-instance";
export interface SeedResult {
    readonly plansInserted: number;
    readonly featuresInserted: number;
    readonly entitlementsInserted: number;
}
declare const PLAN_FREE_ID = "plan_free";
declare const PLAN_LIFETIME_ID = "plan_lifetime";
declare const FEATURE_IDS: {
    readonly websiteLimit: "feat_website_limit";
    readonly customDomain: "feat_custom_domain";
    readonly exportAccess: "feat_export_access";
    readonly pageBuilder: "feat_page_builder";
    readonly formsAccess: "feat_forms_access";
    readonly seoAccess: "feat_seo_access";
    readonly analyticsAccess: "feat_analytics_access";
};
export declare function seedPlansAndFeatures(db: DrizzleDB): Promise<SeedResult>;
export { PLAN_FREE_ID, PLAN_LIFETIME_ID, FEATURE_IDS };
//# sourceMappingURL=seed.d.ts.map