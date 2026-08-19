/**
 * Composition root — development wiring.
 *
 * Uses deterministic/in-memory adapters for local development. This is
 * explicitly named development and is NOT for production use.
 */
import { FakeClock, DeterministicIdGenerator } from "@livingsites/platform";
import type { Logger } from "@livingsites/platform";
import { InMemoryOrganizationRepository, InMemoryPlanRepository, InMemoryUserRepository, InMemoryMembershipRepository, FakeAuthenticationAdapter } from "@livingsites/test-support";
import type { EventPublisher, EmailVerificationPort, CreateOrganizationDeps, RegisterUserDeps, AddOrganizationMemberDeps, ChangeOrganizationMemberRoleDeps, RemoveOrganizationMemberDeps, GetOrganizationMembersDeps } from "@livingsites/application";
import { createOrganization, registerUser, addOrganizationMember, changeOrganizationMemberRole, removeOrganizationMember, getOrganizationMembers, AuthorizationService } from "@livingsites/application";
export interface DevelopmentCompositionConfig {
    readonly initialClockMs?: number;
    readonly eventPublisher?: EventPublisher;
    readonly registrationMode?: "open" | "invite_only" | "disabled";
    readonly emailVerificationPort?: EmailVerificationPort;
}
export interface DevelopmentComposition {
    readonly clock: FakeClock;
    readonly idGenerator: DeterministicIdGenerator;
    readonly logger: Logger;
    readonly eventPublisher: EventPublisher;
    readonly organizationRepository: InMemoryOrganizationRepository;
    readonly planRepository: InMemoryPlanRepository;
    readonly userRepository: InMemoryUserRepository;
    readonly membershipRepository: InMemoryMembershipRepository;
    readonly authorizationService: AuthorizationService;
    readonly authenticationPort: FakeAuthenticationAdapter;
    readonly emailVerificationPort: EmailVerificationPort;
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
export declare function composeDevelopment(config?: DevelopmentCompositionConfig): DevelopmentComposition;
//# sourceMappingURL=development.d.ts.map