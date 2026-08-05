/**
 * @livingsites/composition — the composition root of Living Sites.
 *
 * The SINGLE place where concrete implementations of repository and service
 * contracts are instantiated and wired together.
 *
 * Three composition modes:
 * - composeProduction: requires concrete dependencies (database, plan repo, event publisher).
 *   Fails fast if any are missing. No silent fallback.
 * - composeDevelopment: in-memory adapters for local development. Not for production.
 * - composeTest: deterministic test-support adapters with event capture.
 *
 * Dependency direction:
 *   composition → application → domain
 *   composition → infrastructure → platform
 *   composition → platform (runtime capabilities)
 *   composition → test-support (test/development adapters)
 */
export { composeProduction, MissingProductionDependencyError } from "./production";
export { composeDevelopment } from "./development";
export { composeTest } from "./test";
//# sourceMappingURL=index.js.map