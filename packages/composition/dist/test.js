/**
 * Composition root — test wiring.
 *
 * Uses deterministic test-support adapters. No database, no network.
 * The InMemoryEventPublisher captures events for assertion.
 */
import { FakeClock, DeterministicIdGenerator, NoopLogger } from "@livingsites/platform";
import { InMemoryOrganizationRepository, InMemoryPlanRepository, InMemoryUserRepository, InMemoryMembershipRepository, FakeAuthenticationAdapter, CapturingVerificationEmailAdapter, InMemoryEventPublisher, } from "@livingsites/test-support";
import { createOrganization, registerUser, addOrganizationMember, changeOrganizationMemberRole, removeOrganizationMember, getOrganizationMembers, AuthorizationService, } from "@livingsites/application";
export function composeTest(config = {}) {
    const clock = new FakeClock(config.initialClockMs ?? 0);
    const idGenerator = new DeterministicIdGenerator();
    const logger = new NoopLogger();
    const eventPublisher = new InMemoryEventPublisher();
    const organizationRepository = new InMemoryOrganizationRepository();
    const planRepository = new InMemoryPlanRepository();
    const userRepository = new InMemoryUserRepository();
    const membershipRepository = new InMemoryMembershipRepository();
    const authorizationService = new AuthorizationService({
        membershipReader: membershipRepository,
    });
    const authenticationPort = new FakeAuthenticationAdapter();
    const emailVerificationPort = new CapturingVerificationEmailAdapter();
    const createOrganizationDeps = {
        organizationRepository,
        planRepository,
        eventPublisher,
        clock,
        idGenerator,
    };
    const registerUserDeps = {
        authenticationPort,
        userReader: userRepository,
        userCreator: userRepository,
        eventPublisher,
        clock,
        idGenerator,
        registrationMode: config.registrationMode ?? "open",
    };
    const addOrganizationMemberDeps = {
        membershipRepository,
        userReader: userRepository,
        authorizationService,
        clock,
        idGenerator,
    };
    const changeOrganizationMemberRoleDeps = {
        membershipRepository,
        authorizationService,
        clock,
    };
    const removeOrganizationMemberDeps = {
        membershipRepository,
        authorizationService,
        clock,
    };
    const getOrganizationMembersDeps = {
        membershipRepository,
        authorizationService,
    };
    return {
        clock,
        idGenerator,
        logger,
        eventPublisher,
        organizationRepository,
        planRepository,
        userRepository,
        membershipRepository,
        authorizationService,
        authenticationPort,
        emailVerificationPort,
        createOrganization,
        createOrganizationDeps,
        registerUser,
        registerUserDeps,
        addOrganizationMember,
        addOrganizationMemberDeps,
        changeOrganizationMemberRole,
        changeOrganizationMemberRoleDeps,
        removeOrganizationMember,
        removeOrganizationMemberDeps,
        getOrganizationMembers,
        getOrganizationMembersDeps,
    };
}
//# sourceMappingURL=test.js.map