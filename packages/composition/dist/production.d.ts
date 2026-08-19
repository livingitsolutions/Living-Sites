import type { Clock, IdGenerator, Logger } from "@livingsites/platform";
import { LinkageReconciler, DrizzleSuperAdminStore } from "@livingsites/infrastructure";
import type { BetterAuthInstance } from "@livingsites/infrastructure";
import type { OrganizationReader, OrganizationCreator, PlanReader, FeatureReader, UserReader, UserCreator, MembershipRepository, EventPublisher, OrganizationCreationPersistence, OutboxProcessor, AuthenticationPort, EmailVerificationPort, RegistrationMode } from "@livingsites/application";
import { createOrganization, registerUser, addOrganizationMember, changeOrganizationMemberRole, removeOrganizationMember, getOrganizationMembers, AuthorizationService } from "@livingsites/application";
import type { CreateOrganizationDeps, RegisterUserDeps, AddOrganizationMemberDeps, ChangeOrganizationMemberRoleDeps, RemoveOrganizationMemberDeps, GetOrganizationMembersDeps } from "@livingsites/application";
export interface ProductionCompositionConfig {
    readonly connectionString?: string;
    readonly logLevel?: "trace" | "debug" | "info" | "warn" | "error" | "silent";
    readonly outboxMaxAttempts?: number;
    readonly outboxBaseBackoffMs?: number;
    readonly outboxMaxBackoffMs?: number;
    readonly betterAuthSecret: string;
    readonly betterAuthUrl: string;
    readonly trustedOrigins: readonly string[];
    readonly registrationMode?: string;
    readonly emailVerificationEnabled?: boolean;
    readonly emailAdapter?: EmailVerificationPort;
    readonly linkageBatchSize?: number;
    readonly linkageGracePeriodMs?: number;
    readonly superAdminEmail?: string;
}
export interface ProductionComposition {
    readonly clock: Clock;
    readonly idGenerator: IdGenerator;
    readonly logger: Logger;
    readonly eventPublisher: EventPublisher;
    readonly organizationRepository: OrganizationReader & OrganizationCreator;
    readonly planReader: PlanReader;
    readonly featureReader: FeatureReader;
    readonly userReader: UserReader;
    readonly userCreator: UserCreator;
    readonly membershipRepository: MembershipRepository;
    readonly superAdminStore: DrizzleSuperAdminStore;
    readonly authorizationService: AuthorizationService;
    readonly authenticationPort: AuthenticationPort;
    readonly authInstance: BetterAuthInstance;
    readonly emailVerificationPort: EmailVerificationPort | null;
    readonly organizationCreationPersistence: OrganizationCreationPersistence;
    readonly outboxProcessor: OutboxProcessor;
    readonly linkageReconciler: LinkageReconciler;
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
    readonly registrationMode: RegistrationMode;
    readonly healthCheck: () => Promise<{
        healthy: boolean;
        details: Record<string, boolean>;
    }>;
    readonly close: () => Promise<void>;
}
export declare function composeProduction(config: ProductionCompositionConfig): ProductionComposition;
export declare function composeProductionFromEnvironment(): ProductionComposition;
//# sourceMappingURL=production.d.ts.map