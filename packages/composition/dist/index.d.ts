/**
 * @livingsites/composition — the composition root of Living Sites.
 *
 * The SINGLE place where concrete implementations of repository and service
 * contracts are instantiated and wired together.
 *
 * Three composition modes:
 * - composeProduction: uses Netlify Database + Better Auth. Fails fast if unavailable.
 * - composeDevelopment: in-memory + fake adapters for local development. Not for production.
 * - composeTest: deterministic test-support adapters with event capture.
 */
export { composeProduction, composeProductionFromEnvironment, resolveTrustedOrigins, } from "./production.js";
export type { ProductionComposition, ProductionCompositionConfig } from "./production.js";
export { AdminBootstrapError, reconcileProductionAdministrator, } from "./admin-bootstrap.js";
export type { AdminBootstrapErrorCode, AdminBootstrapInput, AdminBootstrapOptions, AdminBootstrapStatus, } from "./admin-bootstrap.js";
export { MissingNetlifyDatabaseError } from "@livingsites/infrastructure";
export { composeDevelopment } from "./development.js";
export type { DevelopmentComposition, DevelopmentCompositionConfig } from "./development.js";
export { composeTest } from "./test.js";
export type { TestComposition, TestCompositionConfig } from "./test.js";
//# sourceMappingURL=index.d.ts.map