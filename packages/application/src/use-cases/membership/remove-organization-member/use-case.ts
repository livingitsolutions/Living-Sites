import type {
  Result,
  MembershipId,
  UserId,
  ISODateString,
  OrganizationMemberRemovedEvent,
} from "@livingsites/domain";
import type { MembershipReader, MembershipMutator } from "../../../repositories/membership";
import type { EventPublisher } from "../../../services/event-publisher";
import type { AuthorizationService } from "../../../authorization/service";
import { OrganizationPermissions } from "../../../authorization/permissions";
import { normalizeSystemRole } from "../../../authorization/roles";
import type { RemoveOrganizationMemberInput } from "./input";
import type { RemoveOrganizationMemberOutput } from "./output";
import type { RemoveOrganizationMemberError } from "./errors";

export interface RemoveOrganizationMemberDeps {
  readonly membershipRepository: MembershipReader & MembershipMutator;
  readonly authorizationService: AuthorizationService;
  readonly eventPublisher: EventPublisher;
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
    isPlatformSuperAdmin: input.isPlatformSuperAdmin,
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

  // 4. Archive/remove membership via repository
  const deleteResult = await deps.membershipRepository.archive(
    membershipId as MembershipId,
    input.expectedVersion,
  );

  if (!deleteResult.ok) {
    return { ok: false, error: deleteResult.error };
  }

  const now = deps.clock.nowIso() as ISODateString;

  // 5. Emit event
  const event: OrganizationMemberRemovedEvent = {
    type: "organization.member_removed",
    occurredAt: now,
    eventScope: { scope: "organization", organizationId: membership.organizationId },
    membershipId: membership.id,
    userId: membership.userId,
  };

  await deps.eventPublisher.publish(event);

  return { ok: true, value: { success: true } };
}
