import { normalizeOrganizationRole } from "../../../authorization/roles";
export function validateAddOrganizationMemberInput(input) {
    const organizationId = typeof input.organizationId === "string" ? input.organizationId.trim() : "";
    const userId = typeof input.userId === "string" ? input.userId.trim() : "";
    const callerUserId = typeof input.callerUserId === "string" ? input.callerUserId.trim() : "";
    const rawRole = typeof input.role === "string" ? input.role.trim() : "";
    if (!organizationId) {
        return { ok: false, error: { code: "validation_error", message: "organizationId is required." } };
    }
    if (!userId) {
        return { ok: false, error: { code: "validation_error", message: "userId is required." } };
    }
    if (!callerUserId) {
        return { ok: false, error: { code: "validation_error", message: "callerUserId is required." } };
    }
    const role = normalizeOrganizationRole(rawRole);
    if (!role) {
        return {
            ok: false,
            error: {
                code: "validation_error",
                message: `Invalid role: "${rawRole}". Supported roles: owner, admin, editor, viewer.`,
            },
        };
    }
    const websiteScopeId = input.websiteScopeId ? String(input.websiteScopeId).trim() : null;
    return {
        ok: true,
        value: {
            organizationId,
            userId,
            role,
            websiteScopeId,
            callerUserId,
        },
    };
}
//# sourceMappingURL=validator.js.map