import { PageStatus, WebsiteStatus } from "@livingsites/domain";
export async function resolvePublishedWebsite(input, deps) {
    const hostname = input.hostname.trim().toLowerCase().replace(/:\d+$/, "");
    const website = await deps.websiteReader.findByDomain(hostname);
    if (!website || website.status !== WebsiteStatus.Published || website.archivedAt)
        return { ok: false, error: { code: "not_found", message: "Published Website was not found." } };
    return { ok: true, value: { website } };
}
export async function resolvePublishedPage(input, deps) {
    const websiteResult = await resolvePublishedWebsite(input, deps);
    if (!websiteResult.ok)
        return websiteResult;
    const normalizedPath = input.path === "/" ? "/" : `/${input.path.replace(/^\/+|\/+$/g, "")}`;
    const pages = await deps.pageReader.listForWebsite(websiteResult.value.website.id);
    const page = pages.find((candidate) => candidate.status !== PageStatus.Archived && !candidate.archivedAt && (normalizedPath === "/" ? candidate.isHomepage : `/${String(candidate.slug).replace(/^\/+|\/+$/g, "")}` === normalizedPath));
    if (!page?.publishedSnapshotId)
        return { ok: false, error: { code: "not_found", message: "Published Page was not found." } };
    const snapshot = await deps.pageSnapshotReader.findById(page.publishedSnapshotId);
    if (!snapshot || snapshot.pageId !== page.id || snapshot.websiteId !== websiteResult.value.website.id)
        return { ok: false, error: { code: "not_found", message: "Published Page was not found." } };
    return { ok: true, value: { website: websiteResult.value.website, page, snapshot } };
}
//# sourceMappingURL=resolve-published.js.map