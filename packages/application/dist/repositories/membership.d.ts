import type { Membership, MembershipId, OrganizationId, UserId, WebsiteId, AggregateVersion, RoleValue, MembershipDraft, PaginationParams, SystemRole, OrganizationMemberAddedEvent, OrganizationMemberRoleChangedEvent, OrganizationMemberRemovedEvent } from "@livingsites/domain";
import type { CreateResult, SaveResult, MutationResult } from "../contracts.js";
export interface MembershipListParams extends PaginationParams {
    organizationId?: OrganizationId;
    userId?: UserId;
    role?: SystemRole;
}
export interface MembershipReader {
    findById(id: MembershipId): Promise<Membership | null>;
    listForUser(userId: UserId): Promise<Membership[]>;
    findForUserAndOrganization(organizationId: OrganizationId, userId: UserId, websiteId?: WebsiteId | null): Promise<Membership | null>;
    listForUserAndOrganization(organizationId: OrganizationId, userId: UserId): Promise<Membership[]>;
    listForOrganization(organizationId: OrganizationId): Promise<Membership[]>;
    listActiveOwners(organizationId: OrganizationId): Promise<Membership[]>;
}
export interface MembershipCreator {
    create(candidate: MembershipDraft | Omit<Membership, "id" | "audit" | "version">): Promise<CreateResult<Membership>>;
}
export interface MembershipMutator {
    changeRole(membershipId: MembershipId, newRole: RoleValue, expectedVersion: AggregateVersion): Promise<SaveResult<Membership>>;
    archive(membershipId: MembershipId, expectedVersion: AggregateVersion): Promise<MutationResult>;
}
export interface MembershipRepository extends MembershipReader, MembershipCreator, MembershipMutator {
    softDelete(id: MembershipId, expectedVersion: AggregateVersion): Promise<MutationResult>;
}
export interface MembershipMutationPersistence {
    createWithEvent(candidate: MembershipDraft | Omit<Membership, "id" | "audit" | "version">, event: OrganizationMemberAddedEvent): Promise<CreateResult<Membership>>;
    changeRoleWithEvent(membershipId: MembershipId, newRole: RoleValue, expectedVersion: AggregateVersion, event: OrganizationMemberRoleChangedEvent): Promise<SaveResult<Membership>>;
    archiveWithEvent(membershipId: MembershipId, expectedVersion: AggregateVersion, event: OrganizationMemberRemovedEvent): Promise<MutationResult>;
}
//# sourceMappingURL=membership.d.ts.map