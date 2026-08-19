import type { Logger } from "@livingsites/platform";
import type { Membership, MembershipId, OrganizationId, UserId, MembershipDraft, AggregateVersion, RoleValue, PaginatedResult } from "@livingsites/domain";
import type { CreateResult, SaveResult, MutationResult } from "@livingsites/application";
import type { MembershipRepository, MembershipListParams } from "@livingsites/application";
import type { DrizzleDB } from "../../db/drizzle-instance";
export interface DrizzleMembershipRepositoryConfig {
    readonly db: DrizzleDB;
    readonly logger: Logger;
}
export declare class DrizzleMembershipRepository implements MembershipRepository {
    private readonly db;
    private readonly logger;
    private readonly orgMutex;
    constructor(config: DrizzleMembershipRepositoryConfig);
    findById(id: MembershipId): Promise<Membership | null>;
    findForUserAndOrganization(organizationId: OrganizationId, userId: UserId): Promise<Membership | null>;
    findMembership(organizationId: OrganizationId, userId: UserId): Promise<Membership | null>;
    listForOrganization(organizationId: OrganizationId): Promise<Membership[]>;
    listActiveOwners(organizationId: OrganizationId): Promise<Membership[]>;
    listForUser(userId: UserId): Promise<Membership[]>;
    list(params: MembershipListParams): Promise<PaginatedResult<Membership>>;
    create(candidate: MembershipDraft | Omit<Membership, "id" | "audit" | "version">): Promise<CreateResult<Membership>>;
    changeRole(membershipId: MembershipId, newRole: RoleValue, expectedVersion: AggregateVersion): Promise<SaveResult<Membership>>;
    archive(membershipId: MembershipId, expectedVersion: AggregateVersion): Promise<MutationResult>;
    save(aggregate: Membership, expectedVersion: AggregateVersion): Promise<SaveResult<Membership>>;
    softDelete(id: MembershipId, expectedVersion: AggregateVersion): Promise<MutationResult>;
    private mapCreateError;
    private mapSaveError;
}
//# sourceMappingURL=drizzle-membership-repository.d.ts.map