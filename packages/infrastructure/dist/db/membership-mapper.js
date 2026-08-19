import { normalizeOrganizationRole } from "@livingsites/application";
export function rowToMembership(row) {
    if (!row.id || !row.organization_id || !row.user_id || !row.role) {
        return {
            ok: false,
            error: {
                code: "invalid_persistence_state",
                message: `Membership row ${row.id ?? "unknown"} has missing required fields.`,
            },
        };
    }
    const role = normalizeOrganizationRole(row.role);
    if (!role) {
        return {
            ok: false,
            error: {
                code: "invalid_persistence_state",
                message: `Membership row ${row.id} has invalid organization role "${row.role}".`,
            },
        };
    }
    const audit = {
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        ...(row.created_by ? { createdBy: row.created_by } : {}),
        ...(row.updated_by ? { updatedBy: row.updated_by } : {}),
    };
    const membership = {
        id: row.id,
        organizationId: row.organization_id,
        userId: row.user_id,
        role: role,
        websiteScopeId: row.website_scope_id ?? null,
        status: row.status,
        version: row.version,
        audit,
    };
    return { ok: true, value: membership };
}
export function membershipDraftToInsertData(draft, persistedVersion, generatedId) {
    const now = new Date();
    const id = draft.id ? String(draft.id) : (generatedId ?? String(draft.id));
    const createdAt = draft.audit?.createdAt ? new Date(draft.audit.createdAt) : now;
    const updatedAt = draft.audit?.updatedAt ? new Date(draft.audit.updatedAt) : now;
    return {
        id,
        organization_id: String(draft.organizationId),
        user_id: String(draft.userId),
        role: String(draft.role),
        website_scope_id: draft.websiteScopeId ? String(draft.websiteScopeId) : null,
        status: (draft.status ?? "active"),
        version: persistedVersion,
        created_at: createdAt,
        updated_at: updatedAt,
        created_by: draft.audit?.createdBy ? String(draft.audit.createdBy) : null,
        updated_by: draft.audit?.updatedBy ? String(draft.audit.updatedBy) : null,
        deleted_at: null,
    };
}
//# sourceMappingURL=membership-mapper.js.map