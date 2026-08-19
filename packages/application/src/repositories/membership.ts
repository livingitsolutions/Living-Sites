import type {
  Membership,
  MembershipId,
  OrganizationId,
  UserId,
  AggregateVersion,
  RoleValue,
  MembershipDraft,
  PaginationParams,
  SystemRole,
} from "@livingsites/domain";
import type {
  CreateResult,
  SaveResult,
  MutationResult,
} from "../contracts";

export interface MembershipListParams extends PaginationParams {
  organizationId?: OrganizationId;
  userId?: UserId;
  role?: SystemRole;
}

export interface MembershipReader {
  findById(id: MembershipId): Promise<Membership | null>;
  findForUserAndOrganization(organizationId: OrganizationId, userId: UserId): Promise<Membership | null>;
  listForOrganization(organizationId: OrganizationId): Promise<Membership[]>;
  listActiveOwners(organizationId: OrganizationId): Promise<Membership[]>;
}

export interface MembershipCreator {
  create(candidate: MembershipDraft | Omit<Membership, "id" | "audit" | "version">): Promise<CreateResult<Membership>>;
}

export interface MembershipMutator {
  changeRole(
    membershipId: MembershipId,
    newRole: RoleValue,
    expectedVersion: AggregateVersion,
  ): Promise<SaveResult<Membership>>;

  archive(
    membershipId: MembershipId,
    expectedVersion: AggregateVersion,
  ): Promise<MutationResult>;
}

export interface MembershipRepository extends MembershipReader, MembershipCreator, MembershipMutator {
  save(aggregate: Membership, expectedVersion: AggregateVersion): Promise<SaveResult<Membership>>;
  softDelete(id: MembershipId, expectedVersion: AggregateVersion): Promise<MutationResult>;
}
