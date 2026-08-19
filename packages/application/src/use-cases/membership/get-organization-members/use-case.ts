import type {
  Result,
  OrganizationId,
  UserId,
} from "@livingsites/domain";
import type { MembershipReader } from "../../../repositories/membership";
import type { AuthorizationService } from "../../../authorization/service";
import { OrganizationPermissions } from "../../../authorization/permissions";
import type { GetOrganizationMembersInput } from "./input";
import type { GetOrganizationMembersOutput } from "./output";
import type { GetOrganizationMembersError } from "./errors";

export interface GetOrganizationMembersDeps {
  readonly membershipRepository: MembershipReader;
  readonly authorizationService: AuthorizationService;
}

export async function getOrganizationMembers(
  input: GetOrganizationMembersInput,
  deps: GetOrganizationMembersDeps,
): Promise<Result<GetOrganizationMembersOutput, GetOrganizationMembersError>> {
  const organizationId = typeof input.organizationId === "string" ? input.organizationId.trim() : "";
  const callerUserId = typeof input.callerUserId === "string" ? input.callerUserId.trim() : "";

  if (!organizationId) {
    return { ok: false, error: { code: "validation_error", message: "organizationId is required." } };
  }
  if (!callerUserId) {
    return { ok: false, error: { code: "validation_error", message: "callerUserId is required." } };
  }

  // 1. Authorize caller
  const authDecision = await deps.authorizationService.can({
    userId: callerUserId as UserId,
    organizationId: organizationId as OrganizationId,
    permission: OrganizationPermissions.MembersRead,
    isPlatformSuperAdmin: input.isPlatformSuperAdmin,
  });

  if (!authDecision.allowed) {
    return {
      ok: false,
      error: { code: "unauthorized", message: authDecision.reason },
    };
  }

  // 2. Fetch members
  const members = await deps.membershipRepository.listForOrganization(organizationId as OrganizationId);

  return {
    ok: true,
    value: { members },
  };
}
