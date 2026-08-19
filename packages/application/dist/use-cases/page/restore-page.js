import { PagePermissions } from "../../authorization/permissions.js";
import { proveWebsiteAccess } from "./shared.js";
export async function restorePage(input, deps) {
    const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission: PagePermissions.Archive }, deps);
    if (!access.ok)
        return access;
    const page = await deps.pageReader.findById(input.pageId);
    if (!page || page.websiteId !== input.websiteId)
        return { ok: false, error: { code: "not_found", message: "Page was not found in this Website." } };
    if (page.status !== "archived")
        return { ok: false, error: { code: "invalid_lifecycle", message: "Only archived Pages can be restored." } };
    if (await deps.pageReader.findActiveBySlug(input.websiteId, page.slug))
        return { ok: false, error: { code: "duplicate_slug", message: "Another active Page now uses this slug." } };
    const now = deps.clock.nowIso();
    const event = { type: "page.restored", occurredAt: now, eventScope: { scope: "website", organizationId: input.organizationId, websiteId: input.websiteId }, pageId: input.pageId };
    const saved = await deps.pageMutationPersistence.restoreWithEvent({ pageId: input.pageId, expectedVersion: input.expectedVersion, restoredAt: now, restoredBy: String(deps.authenticatedUser.userId) }, event);
    if (!saved.ok)
        return { ok: false, error: { code: "expectedVersion" in saved.error ? "concurrency_conflict" : "persistence_error", message: "expectedVersion" in saved.error ? "Page changed since it was loaded." : saved.error.message } };
    return saved;
}
//# sourceMappingURL=restore-page.js.map