import { PageStatus, WebsiteStatus } from "@livingsites/domain";
import { PagePermissions } from "../../authorization/permissions.js";
import { getSectionType, validateSectionProps } from "../../section-types/index.js";
export async function publishPage(input, deps) {
    const decision = await deps.authorizationService.can({ userId: deps.authenticatedUser.userId, organizationId: input.organizationId, websiteId: input.websiteId, permission: PagePermissions.Publish });
    if (!decision.allowed)
        return { ok: false, error: { code: "unauthorized", message: decision.reason } };
    const website = await deps.websiteReader.findById(input.websiteId);
    if (!website || website.organizationId !== input.organizationId)
        return { ok: false, error: { code: "website_not_found", message: "Website was not found in this Organization." } };
    if (website.status === WebsiteStatus.Archived)
        return { ok: false, error: { code: "website_inactive", message: "Archived Websites cannot publish Pages." } };
    const page = await deps.pageReader.findById(input.pageId);
    if (!page || page.websiteId !== input.websiteId)
        return { ok: false, error: { code: "page_not_found", message: "Page was not found in this Website." } };
    if (page.status !== PageStatus.Draft)
        return { ok: false, error: { code: "draft_required", message: "Only a draft Page can be published." } };
    if (page.version !== input.expectedVersion)
        return { ok: false, error: { code: "concurrency_conflict", message: "This Page changed in another session. Reload before publishing." } };
    if (!page.sections.length)
        return { ok: false, error: { code: "policy_failed", message: "PageHasContentPolicy blocked publication.", details: ["Add at least one Section before publishing."] } };
    const validationErrors = [];
    const sections = page.sections.map((section, index) => {
        const type = getSectionType(String(section.sectionTypeId));
        if (!type || !type.isActive) {
            validationErrors.push(`Section ${index + 1} uses an unknown or inactive SectionType.`);
            return null;
        }
        const validated = validateSectionProps(type, section.props);
        if (!validated.ok) {
            validationErrors.push(...validated.errors.map((error) => `Section ${index + 1}: ${error}`));
            return null;
        }
        return { sectionId: section.id, sectionTypeId: String(section.sectionTypeId), props: validated.value, sortOrder: index };
    });
    if (validationErrors.length || sections.some((section) => section === null))
        return { ok: false, error: { code: "validation_failed", message: "Section validation blocked publication.", details: validationErrors } };
    const publishedAt = deps.clock.nowIso();
    const path = page.isHomepage ? "/" : `/${String(page.slug).replace(/^\/+|\/+$/g, "")}`;
    const snapshotId = deps.idGenerator.generatePrefixed("snapshot");
    const result = await deps.pagePublisher.publish({
        candidate: {
            id: snapshotId, pageId: page.id, websiteId: website.id, organizationId: website.organizationId,
            releaseVersion: input.releaseVersion, page: { title: page.title, description: page.description, slug: String(page.slug), path, isHomepage: page.isHomepage },
            sections: sections, publishedAt, publishedBy: deps.authenticatedUser.userId,
        },
        expectedPageVersion: input.expectedVersion,
        event: { type: "page.published", occurredAt: publishedAt, eventScope: { scope: "website", organizationId: input.organizationId, websiteId: input.websiteId }, pageId: input.pageId, snapshotId },
    });
    if (!result.ok)
        return { ok: false, error: { code: result.error.code, message: result.error.message } };
    return result;
}
//# sourceMappingURL=publish-page.js.map