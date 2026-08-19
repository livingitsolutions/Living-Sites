import type {
  OrganizationId,
  UserId,
  RoleValue,
  WebsiteId,
} from "@livingsites/domain";

export interface AddOrganizationMemberInput {
  readonly organizationId: OrganizationId | string;
  readonly userId: UserId | string;
  readonly role: RoleValue | string;
  readonly websiteScopeId?: WebsiteId | string | null;
  readonly callerUserId: UserId | string;
  readonly isPlatformSuperAdmin?: boolean;
}
