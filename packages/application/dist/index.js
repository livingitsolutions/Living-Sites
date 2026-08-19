/**
 * @livingsites/application — application layer contracts.
 *
 * Repository and service contracts for the Living Sites platform. No
 * implementation, no I/O, no framework bindings. The UI and API layers depend
 * on these contracts, never on repositories or persistence directly.
 *
 * Dependency direction: application → domain. Application depends on the
 * domain model for entity types; domain depends on nothing.
 *
 * Repository error and result contracts (RepositoryError, SaveResult,
 * CreateResult, CreateError, SaveError, MutationResult) live here — not in
 * domain. Domain expresses business consistency conflicts
 * (ConcurrencyConflict, AggregateVersion); repository and persistence
 * failures belong to Application contracts.
 */
export * from "./contracts.js";
export * from "./authorization/index.js";
export * from "./identity/index.js";
export * from "./repositories/index.js";
export * from "./services/index.js";
export * from "./use-cases/index.js";
export * from "./policies/index.js";
export * from "./read-models/index.js";
export * from "./section-types/index.js";
//# sourceMappingURL=index.js.map