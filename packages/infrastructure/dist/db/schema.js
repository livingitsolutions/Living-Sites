/**
 * Drizzle schema for all Living Sites tables.
 *
 * Internal to Infrastructure. Row types are NOT exported from the
 * Infrastructure public barrel — they stay private to the Drizzle adapter
 * modules. Only adapters and composition-facing factories are exported.
 */
import { sql } from "drizzle-orm";
import { check, pgTable, text, integer, numeric, boolean, timestamp, pgEnum, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
/* ---------- Organizations ---------- */
export const orgStatusEnum = pgEnum("org_status", ["active", "archived", "deleted"]);
export const organizations = pgTable("organizations", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    billing_email: text("billing_email").notNull(),
    plan_id: text("plan_id"),
    status: orgStatusEnum("status").notNull().default("active"),
    feature_overrides: text("feature_overrides").notNull().default("[]"),
    version: integer("version").notNull().default(1),
    created_at: timestamp("created_at", { withTimezone: true }).notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull(),
    created_by: text("created_by"),
    updated_by: text("updated_by"),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
});
/* ---------- Websites ---------- */
export const websiteStatusEnum = pgEnum("website_status", ["draft", "published", "unpublished", "archived"]);
export const websites = pgTable("websites", {
    id: text("id").primaryKey(),
    organization_id: text("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    custom_domain: text("custom_domain"),
    fallback_domain: text("fallback_domain").notNull(),
    status: websiteStatusEnum("status").notNull().default("draft"),
    theme_id: text("theme_id"),
    published_release_label: text("published_release_label"),
    default_locale: text("default_locale").notNull().default("en-US"),
    enabled_locales: jsonb("enabled_locales").notNull().default(["en-US"]),
    settings: jsonb("settings").notNull().default({}),
    version: integer("version").notNull().default(1),
    created_at: timestamp("created_at", { withTimezone: true }).notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull(),
    created_by: text("created_by"),
    updated_by: text("updated_by"),
    archived_at: timestamp("archived_at", { withTimezone: true }),
}, (table) => [
    uniqueIndex("websites_organization_slug_unique").on(table.organization_id, table.slug),
    uniqueIndex("websites_custom_domain_unique").on(table.custom_domain).where(sql `${table.custom_domain} IS NOT NULL`),
    uniqueIndex("websites_fallback_domain_unique").on(table.fallback_domain),
    index("websites_organization_id_idx").on(table.organization_id),
    check("websites_version_check", sql `${table.version} >= 1`),
    check("websites_custom_domain_lowercase_check", sql `${table.custom_domain} IS NULL OR ${table.custom_domain} = lower(${table.custom_domain})`),
    check("websites_fallback_domain_lowercase_check", sql `${table.fallback_domain} = lower(${table.fallback_domain})`),
]);
/* ---------- Pages ---------- */
export const pageStatusEnum = pgEnum("page_status", ["draft", "published", "scheduled", "archived"]);
export const pages = pgTable("pages", {
    id: text("id").primaryKey(),
    website_id: text("website_id").notNull().references(() => websites.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    is_homepage: boolean("is_homepage").notNull().default(false),
    status: pageStatusEnum("status").notNull().default("draft"),
    published_snapshot_id: text("published_snapshot_id"),
    section_order: jsonb("section_order").notNull().default([]),
    available_locales: jsonb("available_locales").notNull().default([]),
    parent_id: text("parent_id"),
    version: integer("version").notNull().default(1),
    created_at: timestamp("created_at", { withTimezone: true }).notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull(),
    created_by: text("created_by"),
    updated_by: text("updated_by"),
    archived_at: timestamp("archived_at", { withTimezone: true }),
}, (table) => [
    uniqueIndex("pages_website_active_slug_unique").on(table.website_id, table.slug).where(sql `${table.status} <> 'archived'`),
    index("pages_website_id_idx").on(table.website_id),
    check("pages_version_check", sql `${table.version} >= 1`),
]);
export const pageSections = pgTable("page_sections", {
    id: text("id").primaryKey(),
    page_id: text("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
    website_id: text("website_id").notNull().references(() => websites.id, { onDelete: "restrict" }),
    section_type_id: text("section_type_id").notNull(),
    sort_order: integer("sort_order").notNull(),
    props: jsonb("props").notNull().default({}),
    status: text("status").notNull().default("active"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull(),
    created_by: text("created_by"),
    updated_by: text("updated_by"),
}, (table) => [
    uniqueIndex("page_sections_page_order_unique").on(table.page_id, table.sort_order),
    index("page_sections_page_id_idx").on(table.page_id),
    check("page_sections_order_check", sql `${table.sort_order} >= 0`),
    check("page_sections_status_check", sql `${table.status} IN ('active', 'archived')`),
]);
export const pageSnapshots = pgTable("page_snapshots", {
    id: text("id").primaryKey(),
    page_id: text("page_id").notNull().references(() => pages.id, { onDelete: "restrict" }),
    website_id: text("website_id").notNull().references(() => websites.id, { onDelete: "restrict" }),
    organization_id: text("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
    revision_number: integer("revision_number").notNull(),
    release_version: text("release_version"),
    page_metadata: jsonb("page_metadata").notNull(),
    sections: jsonb("sections").notNull(),
    seo: jsonb("seo"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull(),
    published_at: timestamp("published_at", { withTimezone: true }).notNull(),
    published_by: text("published_by").notNull(),
}, (table) => [
    uniqueIndex("page_snapshots_page_revision_unique").on(table.page_id, table.revision_number),
    index("page_snapshots_page_id_idx").on(table.page_id),
    index("page_snapshots_website_id_idx").on(table.website_id),
    check("page_snapshots_revision_check", sql `${table.revision_number} >= 1`),
]);
/* ---------- Plans ---------- */
export const planTierEnum = pgEnum("plan_tier", ["starter", "pro", "business", "enterprise"]);
export const featureCategoryEnum = pgEnum("feature_category", ["limit", "capability", "addon"]);
export const plans = pgTable("plans", {
    id: text("id").primaryKey(),
    tier: planTierEnum("tier").notNull(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    price_monthly: integer("price_monthly").notNull().default(0),
    price_annual: integer("price_annual").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    max_websites: integer("max_websites"),
    max_members: integer("max_members"),
    custom_domains_allowed: boolean("custom_domains_allowed").notNull().default(false),
    is_active: boolean("is_active").notNull().default(true),
    version: integer("version").notNull().default(1),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    created_by: text("created_by"),
    updated_by: text("updated_by"),
    deactivated_at: timestamp("deactivated_at", { withTimezone: true }),
});
/* ---------- Features ---------- */
export const features = pgTable("features", {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    category: featureCategoryEnum("category").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    value_type: text("value_type").notNull().default("boolean"),
    is_active: boolean("is_active").notNull().default(true),
    version: integer("version").notNull().default(1),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    created_by: text("created_by"),
    updated_by: text("updated_by"),
});
/* ---------- Plan Feature Entitlements ---------- */
export const planFeatureEntitlements = pgTable("plan_feature_entitlements", {
    id: text("id").primaryKey(),
    plan_id: text("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
    feature_id: text("feature_id").notNull().references(() => features.id, { onDelete: "cascade" }),
    value: numeric("value").notNull().default("0"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
/* ---------- Application Outbox ---------- */
export const applicationOutbox = pgTable("application_outbox", {
    id: text("id").primaryKey(),
    event_type: text("event_type").notNull(),
    aggregate_type: text("aggregate_type").notNull(),
    aggregate_id: text("aggregate_id").notNull(),
    organization_id: text("organization_id"),
    website_id: text("website_id"),
    payload: jsonb("payload").notNull(),
    occurred_at: timestamp("occurred_at", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").notNull().default("pending"),
    attempt_count: integer("attempt_count").notNull().default(0),
    available_at: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    processed_at: timestamp("processed_at", { withTimezone: true }),
    last_error: text("last_error"),
    idempotency_key: text("idempotency_key").notNull().unique(),
    schema_version: text("schema_version").notNull().default("1.0.0"),
});
/* ---------- Platform Users ---------- */
export const userStatusEnum = pgEnum("user_status", ["active", "archived", "deleted"]);
export const platformUsers = pgTable("platform_users", {
    id: text("id").primaryKey(),
    auth_subject_id: text("auth_subject_id").notNull().unique(),
    email: text("email").notNull().unique(),
    display_name: text("display_name").notNull(),
    status: userStatusEnum("status").notNull().default("active"),
    version: integer("version").notNull().default(1),
    created_at: timestamp("created_at", { withTimezone: true }).notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull(),
    created_by: text("created_by"),
    updated_by: text("updated_by"),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
});
/* ---------- Memberships ---------- */
export const membershipStatusEnum = pgEnum("membership_status", ["active", "archived", "deleted"]);
export const memberships = pgTable("memberships", {
    id: text("id").primaryKey(),
    organization_id: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    user_id: text("user_id").notNull().references(() => platformUsers.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    website_scope_id: text("website_scope_id"),
    status: membershipStatusEnum("status").notNull().default("active"),
    version: integer("version").notNull().default(1),
    created_at: timestamp("created_at", { withTimezone: true }).notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull(),
    created_by: text("created_by"),
    updated_by: text("updated_by"),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    check("memberships_role_check", sql `${table.role} IN ('owner', 'admin', 'editor', 'viewer')`),
]);
/* ---------- Platform Super Admins ---------- */
export const platformSuperAdmins = pgTable("platform_super_admins", {
    id: text("id").primaryKey(),
    user_id: text("user_id").notNull().unique().references(() => platformUsers.id, { onDelete: "cascade" }),
    email: text("email").notNull().unique(),
    singleton_key: integer("singleton_key").notNull().default(1).unique(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    created_by: text("created_by"),
}, (table) => [
    check("platform_super_admins_singleton_check", sql `${table.singleton_key} = 1`),
]);
/* ---------- Better Auth Tables ---------- */
export const betterAuthUsers = pgTable("ba_user", {
    id: text("id").primaryKey(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    email: text("email").notNull().unique(),
    email_verified: boolean("email_verified").notNull().default(false),
    name: text("name").notNull(),
    image: text("image"),
    disabled: boolean("disabled").notNull().default(false),
    disabled_at: timestamp("disabled_at", { withTimezone: true }),
});
export const betterAuthSessions = pgTable("ba_session", {
    id: text("id").primaryKey(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    user_id: text("user_id").notNull().references(() => betterAuthUsers.id, { onDelete: "cascade" }),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ip_address: text("ip_address"),
    user_agent: text("user_agent"),
});
export const betterAuthAccounts = pgTable("ba_account", {
    id: text("id").primaryKey(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    provider_id: text("provider_id").notNull(),
    issuer: text("issuer").notNull(),
    account_id: text("account_id").notNull(),
    user_id: text("user_id").notNull().references(() => betterAuthUsers.id, { onDelete: "cascade" }),
    access_token: text("access_token"),
    refresh_token: text("refresh_token"),
    id_token: text("id_token"),
    access_token_expires_at: timestamp("access_token_expires_at", { withTimezone: true }),
    refresh_token_expires_at: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
});
export const betterAuthVerifications = pgTable("ba_verification", {
    id: text("id").primaryKey(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    value: text("value").notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    identifier: text("identifier").notNull(),
});
//# sourceMappingURL=schema.js.map