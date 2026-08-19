import { createMembershipDraft } from "@livingsites/domain";
import { OrganizationPermissions } from "../../../authorization/permissions";
import { validateAddOrganizationMemberInput } from "./validator";
export async function addOrganizationMember(input, deps) {
    const validation = validateAddOrganizationMemberInput(input);
    if (!validation.ok) {
        return { ok: false, error: validation.error };
    }
    const { organizationId, userId, role, websiteScopeId, callerUserId, isPlatformSuperAdmin } = validation.value;
    // 1. Authorize caller
    const authDecision = await deps.authorizationService.can({
        userId: callerUserId,
        organizationId: organizationId,
        permission: OrganizationPermissions.MembersInvite,
        isPlatformSuperAdmin,
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
    const existing = await deps.membershipRepository.findForUserAndOrganization(organizationId, userId);
    if (existing && existing.status === "active") {
        // If org-wide or same scope
        if (!websiteScopeId || existing.websiteScopeId === websiteScopeId) {
            return {
                ok: false,
                error: {
                    code: "duplicate_membership",
                    message: `User "${userId}" is already a member of organization "${organizationId}".`,
                    userId,
                },
            };
        }
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
    // 5. Persist
    const createResult = await deps.membershipRepository.create(draft);
    if (!createResult.ok) {
        return { ok: false, error: createResult.error };
    }
    const persisted = createResult.value;
    // 6. Emit event
    const event = {
        type: "organization.member_added",
        occurredAt: now,
        eventScope: { scope: "organization", organizationId: organizationId },
        membershipId: persisted.id,
        userId: persisted.userId,
        role: persisted.role,
        websiteScopeId: persisted.websiteScopeId,
    };
    await deps.eventPublisher.publish(event);
    return { ok: true, value: { membership: persisted } };
}
//# sourceMappingURL=use-case.js.map