import { WebsiteStatus } from "@livingsites/domain";
import { PagePermissions } from "../../authorization/permissions.js";
export async function rollbackPagePublication(input, deps) {
    const decision = await deps.authorizationService.can({ userId: deps.authenticatedUser.userId, organizationId: input.organizationId, websiteId: input.websiteId, permission: PagePermissions.Publish });
    if (!decision.allowed)
        return { ok: false, error: { code: "unauthorized", message: decision.reason } };
    const website = await deps.websiteReader.findById(input.websiteId);
    if (!website || website.organizationId !== input.organizationId)
        return { ok: false, error: { code: "website_not_found", message: "Website was not found in this Organization." } };
    if (website.status === WebsiteStatus.Archived)
        return { ok: false, error: { code: "website_inactive", message: "Archived Websites cannot rollback Page publications." } };
    const page = await deps.pageReader.findById(input.pageId);
    if (!page || page.websiteId !== input.websiteId)
        return { ok: false, error: { code: "page_not_found", message: "Page was not found in this Website." } };
    if (page.version !== input.expectedVersion)
        return { ok: false, error: { code: "concurrency_conflict", message: "This Page changed in another session. Reload before rolling back." } };
    const target = await deps.pageSnapshotReader.findByRevision(input.pageId, input.targetRevisionNumber);
    if (!target || target.organizationId !== input.organizationId || target.websiteId !== input.websiteId)
        return { ok: false, error: { code: "snapshot_not_found", message: "Published revision was not found for this Page." } };
    const rolledBackAt = deps.clock.nowIso();
    const newSnapshotId = deps.idGenerator.generatePrefixed("snapshot");
    const result = await deps.pageRollbackPersistence.rollback({
        pageId: input.pageId, websiteId: input.websiteId, organizationId: input.organizationId, targetRevisionNumber: input.targetRevisionNumber,
        newSnapshotId, expectedPageVersion: input.expectedVersion, rolledBackAt, rolledBackBy: deps.authenticatedUser.userId,
        event: { type: "page.publication_rolled_back", occurredAt: rolledBackAt, eventScope: { scope: "website", organizationId: input.organizationId, websiteId: input.websiteId }, pageId: input.pageId, targetRevisionNumber: input.targetRevisionNumber, newSnapshotId },
    });
    if (!result.ok)
        return { ok: false, error: result.error };
    return result;
}
//# sourceMappingURL=rollback-page-publication.js.map