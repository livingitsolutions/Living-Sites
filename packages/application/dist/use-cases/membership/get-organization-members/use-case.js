import { OrganizationPermissions } from "../../../authorization/permissions";
export async function getOrganizationMembers(input, deps) {
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
        userId: callerUserId,
        organizationId: organizationId,
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
    const members = await deps.membershipRepository.listForOrganization(organizationId);
    return {
        ok: true,
        value: { members },
    };
}
//# sourceMappingURL=use-case.js.map