/**
 * Policy catalog barrel.
 *
 * Aggregates policy documentation placeholders for every bounded context.
 * Each subfolder contains a README.md describing the policies for that
 * context and an index.ts with export placeholders.
 *
 * Policies are business rules, not permissions (authorization), not feature
 * flags (rollout), not repositories (data access). Policies are evaluated by
 * use cases before performing an operation. They are deterministic, reusable,
 * and depend only on their inputs.
 *
 * No implementations in this milestone — architecture only.
 */
export * from "./shared/index.js";
export * from "./subscription/index.js";
export * from "./website/index.js";
export * from "./page/index.js";
export * from "./publishing/index.js";
export * from "./seo/index.js";
export * from "./media/index.js";
export * from "./storage/index.js";
export * from "./export/index.js";
export * from "./builder/index.js";
export * from "./organization/index.js";
export * from "./platform/index.js";
export * from "./forms/index.js";
export * from "./ai/index.js";
