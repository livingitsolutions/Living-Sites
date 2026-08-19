import { createPageDraft, normalizePageSlug } from "@livingsites/domain";
import { PagePermissions } from "../../authorization/permissions";
import { PageSlugPolicy, PageWebsiteActivePolicy } from "../../policies/page";
import { proveWebsiteAccess } from "./shared";
export async function createPage(input, deps) {
    const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission: PagePermissions.Create }, deps);
    if (!access.ok)
        return access;
    if (new PageWebsiteActivePolicy().evaluate(access.value.status).outcome === "deny")
        return { ok: false, error: { code: "policy_denial", message: "Pages cannot be created for an archived Website." } };
    let slug;
    try {
        slug = normalizePageSlug(input.slug);
    }
    catch (error) {
        return { ok: false, error: { code: "input_validation", message: String(error instanceof Error ? error.message : error), field: "slug" } };
    }
    const duplicate = await deps.pageReader.findActiveBySlug(input.websiteId, slug);
    const slugDecision = new PageSlugPolicy().evaluate(slug, duplicate !== null);
    if (slugDecision.outcome === "deny")
        return { ok: false, error: { code: "duplicate_slug", message: slugDecision.message, field: "slug" } };
    const now = deps.clock.nowIso();
    let draft;
    try {
        draft = createPageDraft({ id: deps.idGenerator.generatePrefixed("page"), websiteId: input.websiteId, title: input.title, slug, now, createdBy: deps.authenticatedUser.userId, ...(input.description ? { description: input.description } : {}) });
    }
    catch (error) {
        return { ok: false, error: { code: "input_validation", message: String(error instanceof Error ? error.message : error), field: "title" } };
    }
    const event = { type: "page.created", occurredAt: now, eventScope: { scope: "website", organizationId: input.organizationId, websiteId: input.websiteId }, pageId: draft.id, slug: String(draft.slug) };
    const result = await deps.pageCreationPersistence.createWithEvent(draft, event);
    if (!result.ok)
        return { ok: false, error: { code: result.error.code === "duplicate_key" ? "duplicate_slug" : "persistence_error", message: result.error.message, ...(result.error.code === "duplicate_key" ? { field: "slug" } : {}) } };
    return { ok: true, value: result.value };
}
//# sourceMappingURL=create-page.js.map