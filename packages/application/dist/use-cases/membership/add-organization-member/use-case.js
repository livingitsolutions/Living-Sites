import { createMembershipDraft } from "@livingsites/domain";
import { OrganizationPermissions } from "../../../authorization/permissions.js";
import { validateAddOrganizationMemberInput } from "./validator.js";
export async function addOrganizationMember(input, deps) {
    const validation = validateAddOrganizationMemberInput(input);
    if (!validation.ok) {
        return { ok: false, error: validation.error };
    }
    const { organizationId, userId, role, websiteScopeId, callerUserId } = validation.value;
    // 1. Authorize caller
    const authDecision = await deps.authorizationService.can({
        userId: callerUserId,
        organizationId: organizationId,
        permission: OrganizationPermissions.MembersInvite,
    });
    if (!authDecision.allowed) {
        return {
            ok: false,
            error: { code: "unauthorized", message: authDecision.reason },
        };
    }
    // 2. Check if user exists (if userReader is provided)
    if (deps.userReader) {
        const user = await deps.userReader.findById(userId);
        if (!user) {
            return {
                ok: false,
                error: { code: "user_not_found", message: `User "${userId}" was not found.`, userId },
            };
        }
    }
    // 3. Check for existing active membership
    const existingMemberships = await deps.membershipRepository.listForUserAndOrganization(organizationId, userId);
    const duplicate = existingMemberships.some((membership) => (membership.websiteScopeId ?? null) === websiteScopeId);
    if (duplicate) {
        return {
            ok: false,
            error: {
                code: "duplicate_membership",
                message: `User "${userId}" already has an active membership for this organization scope.`,
                userId,
            },
        };
    }
    // 4. Create membership draft
    const membershipId = (deps.idGenerator.generatePrefixed ? deps.idGenerator.generatePrefixed("mem") : deps.idGenerator.generate());
    const now = deps.clock.nowIso();
    const draft = createMembershipDraft({
        id: membershipId,
        organizationId: organizationId,
        userId: userId,
        role: role,
        websiteScopeId,
        now,
        createdBy: callerUserId,
    });
    const event = {
        type: "organization.member_added",
        occurredAt: now,
        eventScope: { scope: "organization", organizationId: organizationId },
        membershipId,
        userId: userId,
        role,
        websiteScopeId,
    };
    const createResult = await deps.membershipRepository.createWithEvent(draft, event);
    if (!createResult.ok) {
        return { ok: false, error: createResult.error };
    }
    return { ok: true, value: { membership: createResult.value } };
}
//# sourceMappingURL=use-case.js.map