import type { AggregateVersion, Membership, MembershipDraft, MembershipId, OrganizationId, OrganizationMemberAddedEvent, OrganizationMemberRemovedEvent, OrganizationMemberRoleChangedEvent, PaginatedResult, RoleValue, UserId, WebsiteId } from "@livingsites/domain";
import type { CreateResult, MembershipListParams, MembershipMutationPersistence, MembershipRepository, MutationResult, SaveResult } from "@livingsites/application";
type MembershipEvent = OrganizationMemberAddedEvent | OrganizationMemberRoleChangedEvent | OrganizationMemberRemovedEvent;
export declare class InMemoryMembershipRepository implements MembershipRepository, MembershipMutationPersistence {
    private store;
    readonly publishedEvents: MembershipEvent[];
    findById(id: MembershipId): Promise<Membership | null>;
    findForUserAndOrganization(organizationId: OrganizationId, userId: UserId, websiteId?: WebsiteId | null): Promise<Membership | null>;
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
    clear(): void;
    private notFound;
    private conflict;
    private toDomain;
}
export {};
//# sourceMappingURL=in-memory-membership-repository.d.ts.map