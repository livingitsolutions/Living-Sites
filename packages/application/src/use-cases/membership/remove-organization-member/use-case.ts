import type {
  Result,
  MembershipId,
  UserId,
  ISODateString,
  OrganizationMemberRemovedEvent,
} from "@livingsites/domain";
import type { MembershipReader, MembershipMutationPersistence } from "../../../repositories/membership.js";
import type { AuthorizationService } from "../../../authorization/service.js";
import { OrganizationPermissions } from "../../../authorization/permissions.js";
import { normalizeSystemRole } from "../../../authorization/roles.js";
import type { RemoveOrganizationMemberInput } from "./input.js";
import type { RemoveOrganizationMemberOutput } from "./output.js";
import type { RemoveOrganizationMemberError } from "./errors.js";

export interface RemoveOrganizationMemberDeps {
  readonly membershipRepository: MembershipReader & MembershipMutationPersistence;
  readonly authorizationService: AuthorizationService;
  readonly clock: { nowIso(): string };
}

export async function removeOrganizationMember(
  input: RemoveOrganizationMemberInput,
  deps: RemoveOrganizationMemberDeps,
): Promise<Result<RemoveOrganizationMemberOutput, RemoveOrganizationMemberError>> {
  const membershipId = typeof input.membershipId === "string" ? input.membershipId.trim() : "";
  const callerUserId = typeof input.callerUserId === "string" ? input.callerUserId.trim() : "";

  if (!membershipId) {
    return { ok: false, error: { code: "validation_error", message: "membershipId is required." } };
  }
  if (!callerUserId) {
    return { ok: false, error: { code: "validation_error", message: "callerUserId is required." } };
  }

  // 1. Fetch membership
  const membership = await deps.membershipRepository.findById(membershipId as MembershipId);
  if (!membership || membership.status !== "active") {
    return {
      ok: false,
      error: { code: "membership_not_found", message: `Membership "${membershipId}" was not found.`, membershipId },
    };
  }

  // 2. Authorize caller
  const authDecision = await deps.authorizationService.can({
    userId: callerUserId as UserId,
    organizationId: membership.organizationId,
    permission: OrganizationPermissions.MembersRemove,
  });

  if (!authDecision.allowed) {
    return {
      ok: false,
      error: { code: "unauthorized", message: authDecision.reason },
    };
  }

  // 3. Check sole owner removal invariant
  const currentNormalizedRole = normalizeSystemRole(membership.role);
  if (currentNormalizedRole === "owner") {
    const activeOwners = await deps.membershipRepository.listActiveOwners(membership.organizationId);
    if (activeOwners.length <= 1 && activeOwners.some((m) => m.id === membership.id)) {
      return {
        ok: false,
        error: {
          code: "cannot_remove_sole_owner",
          message: "Cannot remove the final active organization owner.",
          organizationId: membership.organizationId,
        },
      };
    }
  }

  const now = deps.clock.nowIso() as ISODateString;
  const event: OrganizationMemberRemovedEvent = {
    type: "organization.member_removed",
    occurredAt: now,
    eventScope: { scope: "organization", organizationId: membership.organizationId },
    membershipId: membership.id,
    userId: membership.userId,
  };

  const deleteResult = await deps.membershipRepository.archiveWithEvent(
    membershipId as MembershipId,
    input.expectedVersion,
    event,
  );

  if (!deleteResult.ok) {
    return { ok: false, error: deleteResult.error };
  }

  return { ok: true, value: { success: true } };
}
