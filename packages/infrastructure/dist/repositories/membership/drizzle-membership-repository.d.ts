import type { Logger } from "@livingsites/platform";
import type { AggregateVersion, Membership, MembershipDraft, MembershipId, OrganizationId, OrganizationMemberAddedEvent, OrganizationMemberRemovedEvent, OrganizationMemberRoleChangedEvent, PaginatedResult, RoleValue, UserId, WebsiteId } from "@livingsites/domain";
import type { CreateResult, MembershipListParams, MembershipMutationPersistence, MembershipRepository, MutationResult, SaveResult } from "@livingsites/application";
import type { DrizzleDB } from "../../db/drizzle-instance.js";
export interface DrizzleMembershipRepositoryConfig {
    readonly db: DrizzleDB;
    readonly logger: Logger;
    readonly schemaVersion?: string;
}
export declare class DrizzleMembershipRepository implements MembershipRepository, MembershipMutationPersistence {
    private readonly rootDb;
    private readonly logger;
    private readonly schemaVersion;
    constructor(config: DrizzleMembershipRepositoryConfig);
    private get db();
    findById(id: MembershipId): Promise<Membership | null>;
    findForUserAndOrganization(organizationId: OrganizationId, userId: UserId, websiteId?: WebsiteId | null): Promise<Membership | null>;
    findMembership(organizationId: OrganizationId, userId: UserId, websiteId?: WebsiteId | null): Promise<Membership | null>;
    listForUserAndOrganization(organizationId: OrganizationId, userId: UserId): Promise<Membership[]>;
    listForOrganization(organizationId: OrganizationId): Promise<Membership[]>;
    listActiveOwners(organizationId: OrganizationId): Promise<Membership[]>;
    listForUser(userId: UserId): Promise<Membership[]>;
    list(params: MembershipListParams): Promise<PaginatedResult<Membership>>;
    create(candidate: MembershipDraft | Omit<Membership, "id" | "audit" | "version">): Promise<CreateResult<Membership>>;
    createWithEvent(candidate: MembershipDraft | Omit<Membership, "id" | "audit" | "version">, event: OrganizationMemberAddedEvent): Promise<CreateResult<Membership>>;
    changeRole(membershipId: MembershipId, newRole: RoleValue, expectedVersion: AggregateVersion): Promise<SaveResult<Membership>>;
    changeRoleWithEvent(membershipId: MembershipId, newRole: RoleValue, expectedVersion: AggregateVersion, event: OrganizationMemberRoleChangedEvent): Promise<SaveResult<Membership>>;
    archive(membershipId: MembershipId, expectedVersion: AggregateVersion): Promise<MutationResult>;
    archiveWithEvent(membershipId: MembershipId, expectedVersion: AggregateVersion, event: OrganizationMemberRemovedEvent): Promise<MutationResult>;
    softDelete(id: MembershipId, expectedVersion: AggregateVersion): Promise<MutationResult>;
    private changeRoleTransaction;
    private archiveTransaction;
    private createWithDb;
    private findByIdWithDb;
    private listActiveOwnersWithDb;
    private lockOrganization;
    private buildMembershipOutboxInsert;
    private mapRows;
    private notFound;
    private concurrencyConflict;
    private mapCreateError;
    private mapSaveError;
}
//# sourceMappingURL=drizzle-membership-repository.d.ts.map