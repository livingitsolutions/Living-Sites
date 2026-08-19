import { OrganizationPermissions } from "../../../authorization/permissions";
import { normalizeOrganizationRole, normalizeSystemRole } from "../../../authorization/roles";
export async function changeOrganizationMemberRole(input, deps) {
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
    const membership = await deps.membershipRepository.findById(membershipId);
    if (!membership || membership.status !== "active") {
        return {
            ok: false,
            error: { code: "membership_not_found", message: `Membership "${membershipId}" was not found.`, membershipId },
        };
    }
    // 2. Authorize caller
    const authDecision = await deps.authorizationService.can({
        userId: callerUserId,
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
    const now = deps.clock.nowIso();
    const event = {
        type: "organization.member_role_changed",
        occurredAt: now,
        eventScope: { scope: "organization", organizationId: membership.organizationId },
        membershipId: membership.id,
        userId: membership.userId,
        previousRole,
        newRole,
    };
    const updateResult = await deps.membershipRepository.changeRoleWithEvent(membershipId, newRole, input.expectedVersion, event);
    if (!updateResult.ok) {
        return { ok: false, error: updateResult.error };
    }
    return { ok: true, value: { membership: updateResult.value } };
}
//# sourceMappingURL=use-case.js.map