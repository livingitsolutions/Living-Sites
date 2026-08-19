import { PagePermissions } from "../../authorization/permissions";
import { proveWebsiteAccess } from "./shared";
export async function archivePage(input, deps) {
    const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission: PagePermissions.Archive }, deps);
    if (!access.ok)
        return access;
    const page = await deps.pageReader.findById(input.pageId);
    if (!page || page.websiteId !== input.websiteId)
        return { ok: false, error: { code: "not_found", message: "Page was not found in this Website." } };
    if (page.status === "archived")
        return { ok: false, error: { code: "invalid_lifecycle", message: "Page is already archived." } };
    const now = deps.clock.nowIso();
    const event = { type: "page.archived", occurredAt: now, eventScope: { scope: "website", organizationId: input.organizationId, websiteId: input.websiteId }, pageId: input.pageId };
    const saved = await deps.pageMutationPersistence.archiveWithEvent({ pageId: input.pageId, expectedVersion: input.expectedVersion, archivedAt: now, archivedBy: String(deps.authenticatedUser.userId) }, event);
    if (!saved.ok)
        return { ok: false, error: { code: "expectedVersion" in saved.error ? "concurrency_conflict" : "persistence_error", message: "expectedVersion" in saved.error ? "Page changed since it was loaded." : saved.error.message } };
    return saved;
}
//# sourceMappingURL=archive-page.js.map