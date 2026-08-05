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
import { plans, features, planFeatureEntitlements } from "../db/schema";

export interface SeedResult {
  readonly plansInserted: number;
  readonly featuresInserted: number;
  readonly entitlementsInserted: number;
}

const PLAN_FREE_ID = "plan_free";
const PLAN_LIFETIME_ID = "plan_lifetime";

const FEATURE_IDS = {
  websiteLimit: "feat_website_limit",
  customDomain: "feat_custom_domain",
  exportAccess: "feat_export_access",
  pageBuilder: "feat_page_builder",
  formsAccess: "feat_forms_access",
  seoAccess: "feat_seo_access",
  analyticsAccess: "feat_analytics_access",
} as const;

const PLAN_SEEDS = [
  {
    id: PLAN_FREE_ID,
    tier: "starter" as const,
    slug: "free",
    name: "Free",
    description: "Free tier with limited features",
    price_monthly: 0,
    price_annual: 0,
    currency: "usd",
    max_websites: 1,
    max_members: 3,
    custom_domains_allowed: false,
    is_active: true,
    version: 1,
  },
  {
    id: PLAN_LIFETIME_ID,
    tier: "business" as const,
    slug: "lifetime",
    name: "Lifetime",
    description: "Lifetime access with all features included",
    price_monthly: 0,
    price_annual: 0,
    currency: "usd",
    max_websites: null,
    max_members: null,
    custom_domains_allowed: true,
    is_active: true,
    version: 1,
  },
];

const FEATURE_SEEDS = [
  { id: FEATURE_IDS.websiteLimit, key: "website_limit", category: "limit" as const, name: "Website Limit", description: "Maximum number of websites", value_type: "number", is_active: true, version: 1 },
  { id: FEATURE_IDS.customDomain, key: "custom_domain", category: "capability" as const, name: "Custom Domain", description: "Allow custom domain publishing", value_type: "boolean", is_active: true, version: 1 },
  { id: FEATURE_IDS.exportAccess, key: "export_access", category: "capability" as const, name: "Export Access", description: "Access to data export", value_type: "boolean", is_active: true, version: 1 },
  { id: FEATURE_IDS.pageBuilder, key: "page_builder", category: "capability" as const, name: "Page Builder", description: "Access to the page builder", value_type: "boolean", is_active: true, version: 1 },
  { id: FEATURE_IDS.formsAccess, key: "forms_access", category: "capability" as const, name: "Forms", description: "Access to forms", value_type: "boolean", is_active: true, version: 1 },
  { id: FEATURE_IDS.seoAccess, key: "seo_access", category: "capability" as const, name: "SEO", description: "Access to SEO tools", value_type: "boolean", is_active: true, version: 1 },
  { id: FEATURE_IDS.analyticsAccess, key: "analytics_access", category: "capability" as const, name: "Analytics", description: "Access to analytics", value_type: "boolean", is_active: true, version: 1 },
];

const ENTITLEMENT_SEEDS = [
  { id: "ent_free_website_limit", plan_id: PLAN_FREE_ID, feature_id: FEATURE_IDS.websiteLimit, value: "1" },
  { id: "ent_free_custom_domain", plan_id: PLAN_FREE_ID, feature_id: FEATURE_IDS.customDomain, value: "0" },
  { id: "ent_free_export", plan_id: PLAN_FREE_ID, feature_id: FEATURE_IDS.exportAccess, value: "0" },
  { id: "ent_free_page_builder", plan_id: PLAN_FREE_ID, feature_id: FEATURE_IDS.pageBuilder, value: "1" },
  { id: "ent_free_forms", plan_id: PLAN_FREE_ID, feature_id: FEATURE_IDS.formsAccess, value: "1" },
  { id: "ent_free_seo", plan_id: PLAN_FREE_ID, feature_id: FEATURE_IDS.seoAccess, value: "0" },
  { id: "ent_free_analytics", plan_id: PLAN_FREE_ID, feature_id: FEATURE_IDS.analyticsAccess, value: "0" },
  { id: "ent_lifetime_website_limit", plan_id: PLAN_LIFETIME_ID, feature_id: FEATURE_IDS.websiteLimit, value: "999999" },
  { id: "ent_lifetime_custom_domain", plan_id: PLAN_LIFETIME_ID, feature_id: FEATURE_IDS.customDomain, value: "1" },
  { id: "ent_lifetime_export", plan_id: PLAN_LIFETIME_ID, feature_id: FEATURE_IDS.exportAccess, value: "1" },
  { id: "ent_lifetime_page_builder", plan_id: PLAN_LIFETIME_ID, feature_id: FEATURE_IDS.pageBuilder, value: "1" },
  { id: "ent_lifetime_forms", plan_id: PLAN_LIFETIME_ID, feature_id: FEATURE_IDS.formsAccess, value: "1" },
  { id: "ent_lifetime_seo", plan_id: PLAN_LIFETIME_ID, feature_id: FEATURE_IDS.seoAccess, value: "1" },
  { id: "ent_lifetime_analytics", plan_id: PLAN_LIFETIME_ID, feature_id: FEATURE_IDS.analyticsAccess, value: "1" },
];

export async function seedPlansAndFeatures(db: DrizzleDB): Promise<SeedResult> {
  let plansInserted = 0;
  let featuresInserted = 0;
  let entitlementsInserted = 0;

  for (const plan of PLAN_SEEDS) {
    const result = await db
      .insert(plans)
      .values(plan)
      .onConflictDoNothing({ target: plans.id })
      .returning();
    if (result.length > 0) plansInserted++;
  }

  for (const feature of FEATURE_SEEDS) {
    const result = await db
      .insert(features)
      .values(feature)
      .onConflictDoNothing({ target: features.id })
      .returning();
    if (result.length > 0) featuresInserted++;
  }

  for (const entitlement of ENTITLEMENT_SEEDS) {
    const result = await db
      .insert(planFeatureEntitlements)
      .values(entitlement)
      .onConflictDoNothing({ target: planFeatureEntitlements.id })
      .returning();
    if (result.length > 0) entitlementsInserted++;
  }

  return { plansInserted, featuresInserted, entitlementsInserted };
}

export { PLAN_FREE_ID, PLAN_LIFETIME_ID, FEATURE_IDS };
