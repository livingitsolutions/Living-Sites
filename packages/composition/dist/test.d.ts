/**
 * Composition root — test wiring.
 *
 * Uses deterministic test-support adapters. No database, no network.
 * The InMemoryEventPublisher captures events for assertion.
 */
import { FakeClock, DeterministicIdGenerator } from "@livingsites/platform";
import type { Logger } from "@livingsites/platform";
import { InMemoryOrganizationRepository, InMemoryPlanRepository, InMemoryUserRepository, InMemoryMembershipRepository, FakeAuthenticationAdapter, CapturingVerificationEmailAdapter, InMemoryEventPublisher } from "@livingsites/test-support";
import { createOrganization, registerUser, addOrganizationMember, changeOrganizationMemberRole, removeOrganizationMember, getOrganizationMembers, AuthorizationService } from "@livingsites/application";
import type { CreateOrganizationDeps, RegisterUserDeps, AddOrganizationMemberDeps, ChangeOrganizationMemberRoleDeps, RemoveOrganizationMemberDeps, GetOrganizationMembersDeps } from "@livingsites/application";
export interface TestCompositionConfig {
    readonly initialClockMs?: number;
    readonly registrationMode?: "open" | "invite_only" | "disabled";
}
export interface TestComposition {
    readonly clock: FakeClock;
    readonly idGenerator: DeterministicIdGenerator;
    readonly logger: Logger;
    readonly eventPublisher: InMemoryEventPublisher;
    readonly organizationRepository: InMemoryOrganizationRepository;
    readonly planRepository: InMemoryPlanRepository;
    readonly userRepository: InMemoryUserRepository;
    readonly membershipRepository: InMemoryMembershipRepository;
    readonly authorizationService: AuthorizationService;
    readonly authenticationPort: FakeAuthenticationAdapter;
    readonly emailVerificationPort: CapturingVerificationEmailAdapter;
    readonly createOrganization: typeof createOrganization;
    readonly createOrganizationDeps: CreateOrganizationDeps;
    readonly registerUser: typeof registerUser;
    readonly registerUserDeps: RegisterUserDeps;
    readonly addOrganizationMember: typeof addOrganizationMember;
    readonly addOrganizationMemberDeps: AddOrganizationMemberDeps;
    readonly changeOrganizationMemberRole: typeof changeOrganizationMemberRole;
    readonly changeOrganizationMemberRoleDeps: ChangeOrganizationMemberRoleDeps;
    readonly removeOrganizationMember: typeof removeOrganizationMember;
    readonly removeOrganizationMemberDeps: RemoveOrganizationMemberDeps;
    readonly getOrganizationMembers: typeof getOrganizationMembers;
    readonly getOrganizationMembersDeps: GetOrganizationMembersDeps;
}
export declare function composeTest(config?: TestCompositionConfig): TestComposition;
//# sourceMappingURL=test.d.ts.map