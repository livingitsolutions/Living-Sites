/**
 * In-memory Membership repository for testing.
 *
 * Implements MembershipReader, MembershipCreator, MembershipMutator,
 * and MembershipRepository ports.
 */
import type { Membership, MembershipId, OrganizationId, UserId, MembershipDraft, AggregateVersion, RoleValue, PaginatedResult } from "@livingsites/domain";
import type { CreateResult, SaveResult, MutationResult, MembershipRepository, MembershipListParams } from "@livingsites/application";
export declare class InMemoryMembershipRepository implements MembershipRepository {
    private store;
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
    private toDomain;
    clear(): void;
}
//# sourceMappingURL=in-memory-membership-repository.d.ts.map