import { normalizePageSlug } from "@livingsites/domain";
import { PagePermissions } from "../../authorization/permissions";
import { proveWebsiteAccess } from "./shared";
export async function updatePageDetails(input, deps) {
    const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission: PagePermissions.Update }, deps);
    if (!access.ok)
        return access;
    const current = await deps.pageReader.findById(input.pageId);
    if (!current || current.websiteId !== input.websiteId)
        return { ok: false, error: { code: "not_found", message: "Page was not found in this Website." } };
    const title = input.title.trim();
    if (!title || title.length > 200)
        return { ok: false, error: { code: "input_validation", message: "Page title must contain 1 to 200 characters." } };
    let slug;
    try {
        slug = normalizePageSlug(input.slug);
    }
    catch (error) {
        return { ok: false, error: { code: "input_validation", message: String(error instanceof Error ? error.message : error) } };
    }
    const duplicate = await deps.pageReader.findActiveBySlug(input.websiteId, slug);
    if (duplicate && duplicate.id !== input.pageId)
        return { ok: false, error: { code: "duplicate_slug", message: "An active Page already uses this slug." } };
    const saved = await deps.pageMutationPersistence.updateDetails({ pageId: input.pageId, title, slug, ...(input.description?.trim() ? { description: input.description.trim() } : {}), expectedVersion: input.expectedVersion, updatedAt: deps.clock.nowIso(), updatedBy: String(deps.authenticatedUser.userId) });
    if (!saved.ok)
        return { ok: false, error: { code: "expectedVersion" in saved.error ? "concurrency_conflict" : "persistence_error", message: "expectedVersion" in saved.error ? "Page changed since it was loaded." : saved.error.message } };
    return saved;
}
//# sourceMappingURL=update-page-details.js.map