import { WebsiteStatus } from "@livingsites/domain";
import { WebsitePermissions } from "../../../authorization/permissions.js";
export async function unpublishWebsite(input, deps) {
    const authorization = await deps.authorizationService.can({
        userId: deps.authenticatedUser.userId,
        organizationId: input.organizationId,
        websiteId: input.websiteId,
        permission: WebsitePermissions.Publish,
    });
    if (!authorization.allowed)
        return { ok: false, error: { code: "unauthorized", message: authorization.reason } };
    const website = await deps.websiteReader.findById(input.websiteId);
    if (!website || website.organizationId !== input.organizationId)
        return { ok: false, error: { code: "website_not_found", message: "Website was not found in this Organization." } };
    if (website.status === WebsiteStatus.Archived)
        return { ok: false, error: { code: "website_archived", message: "Archived Websites cannot be unpublished." } };
    if (website.version !== input.expectedVersion)
        return { ok: false, error: { code: "concurrency_conflict", message: "This Website changed in another session. Reload before unpublishing." } };
    const changedAt = deps.clock.nowIso();
    const result = await deps.websitePublicationPersistence.unpublishWithEvent({
        websiteId: website.id,
        expectedVersion: input.expectedVersion,
        changedAt,
        changedBy: deps.authenticatedUser.userId,
        event: {
            type: "website.unpublished",
            occurredAt: changedAt,
            eventScope: { scope: "website", organizationId: website.organizationId, websiteId: website.id },
            websiteVersion: website.version + 1,
        },
    });
    return result.ok ? result : { ok: false, error: result.error };
}
//# sourceMappingURL=index.js.map