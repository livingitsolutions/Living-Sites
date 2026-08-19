import { MEMBERSHIP_DRAFT_VERSION } from "./membership-draft";
export function createMembershipDraft(input) {
    const audit = {
        createdAt: input.now,
        updatedAt: input.now,
        ...(input.createdBy ? { createdBy: input.createdBy } : {}),
    };
    return {
        id: input.id,
        organizationId: input.organizationId,
        userId: input.userId,
        role: input.role,
        websiteScopeId: input.websiteScopeId ?? null,
        status: "active",
        version: MEMBERSHIP_DRAFT_VERSION,
        audit,
    };
}
//# sourceMappingURL=membership-factory.js.map