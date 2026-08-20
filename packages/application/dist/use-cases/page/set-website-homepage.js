import { PagePermissions } from "../../authorization/permissions.js";
import { proveWebsiteAccess } from "./shared.js";
export async function setWebsiteHomepage(input, deps) {
    const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission: PagePermissions.Update }, deps);
    if (!access.ok)
        return access;
    const page = await deps.pageReader.findById(input.pageId);
    if (!page || page.websiteId !== input.websiteId)
        return { ok: false, error: { code: "not_found", message: "Page was not found in this Website." } };
    if (page.status === "archived" || page.archivedAt)
        return { ok: false, error: { code: "archived_target", message: "An archived Page cannot be the Website homepage." } };
    if (page.isHomepage)
        return { ok: false, error: { code: "already_homepage", message: "This Page is already the Website homepage." } };
    const occurredAt = deps.clock.nowIso();
    const event = {
        type: "website.homepage_changed",
        occurredAt,
        eventScope: { scope: "website", organizationId: input.organizationId, websiteId: input.websiteId },
        pageId: input.pageId,
    };
    return deps.pageHomepagePersistence.setWebsiteHomepage({ websiteId: input.websiteId, pageId: input.pageId, expectedPageVersion: input.expectedVersion, changedAt: occurredAt, changedBy: deps.authenticatedUser.userId, event });
}
//# sourceMappingURL=set-website-homepage.js.map