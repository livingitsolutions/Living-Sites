/**
 * @livingsites/test-support — test adapters for the Living Sites platform.
 *
 * In-memory repositories, event publishers, and deterministic runtime
 * for tests and development. NOT for production use.
 *
 * Dependency direction:
 *   test-support → application (contracts)
 *   test-support → domain (entity types)
 *   test-support → platform (runtime capabilities)
 *
 * Production packages and production entry points must NOT import test-support.
 */
export { InMemoryOrganizationRepository, InMemoryPlanRepository, InMemoryFeatureRepository } from "./repositories/in-memory-organization-repository.js";
export { InMemoryUserRepository } from "./repositories/in-memory-user-repository.js";
export { InMemoryMembershipRepository } from "./repositories/in-memory-membership-repository.js";
export { FakeAuthenticationAdapter } from "./identity/fake-authentication-adapter.js";
export { CapturingVerificationEmailAdapter } from "./identity/capturing-verification-email-adapter.js";
export { InMemoryEventPublisher } from "./events/in-memory-event-publisher.js";
export { NoopEventPublisher, FakeClock, DeterministicIdGenerator } from "./platform/test-runtime.js";
export { runRepositoryContractTests } from "./repositories/contract-tests.js";
export { runUserRepositoryContractTests } from "./repositories/user-contract-tests.js";
export { runMembershipRepositoryContractTests } from "./repositories/membership-contract-tests.js";
export { runPlanReaderContractTests, runFeatureReaderContractTests, runOutboxContractTests } from "./repositories/plan-feature-outbox-contract-tests.js";
//# sourceMappingURL=index.js.map