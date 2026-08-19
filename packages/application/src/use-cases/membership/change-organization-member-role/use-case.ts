import type {
  Result,
  MembershipId,
  UserId,
  ISODateString,
  OrganizationMemberRoleChangedEvent,
} from "@livingsites/domain";
import type { MembershipReader, MembershipMutationPersistence } from "../../../repositories/membership";
import type { AuthorizationService } from "../../../authorization/service";
import { OrganizationPermissions } from "../../../authorization/permissions";
import { normalizeOrganizationRole, normalizeSystemRole } from "../../../authorization/roles";
import type { ChangeOrganizationMemberRoleInput } from "./input";
import type { ChangeOrganizationMemberRoleOutput } from "./output";
import type { ChangeOrganizationMemberRoleError } from "./errors";

export interface ChangeOrganizationMemberRoleDeps {
  readonly membershipRepository: MembershipReader & MembershipMutationPersistence;
  readonly authorizationService: AuthorizationService;
  readonly clock: { nowIso(): string };
}

export async function changeOrganizationMemberRole(
  input: ChangeOrganizationMemberRoleInput,
  deps: ChangeOrganizationMemberRoleDeps,
): Promise<Result<ChangeOrganizationMemberRoleOutput, ChangeOrganizationMemberRoleError>> {
  const membershipId = typeof input.membershipId === "string" ? input.membershipId.trim() : "";
  const callerUserId = typeof input.callerUserId === "string" ? input.callerUserId.trim() : "";
  const rawRole = typeof input.newRole === "string" ? input.newRole.trim() : "";

  if (!membershipId) {
    return { ok: false, error: { code: "validation_error", message: "membershipId is required." } };
  }
  if (!callerUserId) {
    return { ok: false, error: { code: "validation_error", message: "callerUserId is required." } };
  }
  const newRole = normalizeOrganizationRole(rawRole);
  if (!newRole) {
    return {
      ok: false,
      error: { code: "validation_error", message: `Invalid newRole: "${rawRole}".` },
    };
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
    permission: OrganizationPermissions.MembersUpdate,
  });

  if (!authDecision.allowed) {
    return {
      ok: false,
      error: { code: "unauthorized", message: authDecision.reason },
    };
  }

  // 3. Check sole owner demotion invariant
  const currentNormalizedRole = normalizeSystemRole(membership.role);
  if (currentNormalizedRole === "owner" && newRole !== "owner") {
    const activeOwners = await deps.membershipRepository.listActiveOwners(membership.organizationId);
    if (activeOwners.length <= 1 && activeOwners.some((m) => m.id === membership.id)) {
      return {
        ok: false,
        error: {
          code: "cannot_demote_sole_owner",
          message: "Cannot demote the final active organization owner.",
          organizationId: membership.organizationId,
        },
      };
    }
  }

  const previousRole = membership.role;

  const now = deps.clock.nowIso() as ISODateString;
  const event: OrganizationMemberRoleChangedEvent = {
    type: "organization.member_role_changed",
    occurredAt: now,
    eventScope: { scope: "organization", organizationId: membership.organizationId },
    membershipId: membership.id,
    userId: membership.userId,
    previousRole,
    newRole,
  };

  const updateResult = await deps.membershipRepository.changeRoleWithEvent(
    membershipId as MembershipId,
    newRole as import("@livingsites/domain").RoleValue,
    input.expectedVersion,
    event,
  );

  if (!updateResult.ok) {
    return { ok: false, error: updateResult.error };
  }

  return { ok: true, value: { membership: updateResult.value } };
}
