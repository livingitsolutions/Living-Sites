/**
 * Database module — Drizzle ORM schema, connection, mapper, and migrations.
 *
 * All Drizzle types are confined to Infrastructure. Row types are NOT
 * exported from the public Infrastructure barrel — they stay private to
 * the Drizzle adapter module. Only approved adapters and composition-facing
 * factories are exported.
 */
export { organizations, orgStatusEnum, plans, planTierEnum, features, featureCategoryEnum, planFeatureEntitlements, applicationOutbox, platformUsers, userStatusEnum, betterAuthUsers, betterAuthSessions, betterAuthAccounts, betterAuthVerifications, } from "./schema.js";
export { createDbConnection } from "./connection.js";
export type { DatabaseConfig, DbConnection } from "./connection.js";
export { seedPlansAndFeatures, PLAN_FREE_ID, PLAN_LIFETIME_ID, FEATURE_IDS } from "./seed.js";
export type { SeedResult } from "./seed.js";
//# sourceMappingURL=index.d.ts.map