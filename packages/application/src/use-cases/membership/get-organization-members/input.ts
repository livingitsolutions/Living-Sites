import type {
  OrganizationId,
  UserId,
} from "@livingsites/domain";

export interface GetOrganizationMembersInput {
  readonly organizationId: OrganizationId | string;
  readonly callerUserId: UserId | string;
  readonly isPlatformSuperAdmin?: boolean;
}
