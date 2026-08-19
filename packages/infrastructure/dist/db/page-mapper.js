import { PageStatus } from "@livingsites/domain";
export function rowToPage(row) {
    if (!row.id || !row.website_id || !row.slug || row.version < 1)
        return { ok: false, error: { code: "invalid_persistence_state", message: "Page row is invalid." } };
    if (!Object.values(PageStatus).includes(row.status) || !Array.isArray(row.section_order) || !Array.isArray(row.available_locales))
        return { ok: false, error: { code: "invalid_persistence_state", message: "Page row has invalid aggregate data." } };
    return { ok: true, value: { id: row.id, websiteId: row.website_id, title: row.title, slug: row.slug,
            ...(row.description ? { description: row.description } : {}), isHomepage: row.is_homepage, status: row.status,
            publishedSnapshotId: row.published_snapshot_id, sectionOrder: row.section_order, availableLocales: row.available_locales,
            parentId: row.parent_id, version: row.version,
            audit: { createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), ...(row.created_by ? { createdBy: row.created_by } : {}), ...(row.updated_by ? { updatedBy: row.updated_by } : {}) },
            archivedAt: row.archived_at ? row.archived_at.toISOString() : null } };
}
export function pageDraftToInsert(draft) { return { id: String(draft.id), website_id: String(draft.websiteId), title: draft.title, slug: String(draft.slug), description: draft.description ?? null, is_homepage: draft.isHomepage, status: draft.status, published_snapshot_id: draft.publishedSnapshotId, section_order: [...draft.sectionOrder], available_locales: [...draft.availableLocales], parent_id: draft.parentId ? String(draft.parentId) : null, version: 1, created_at: new Date(draft.audit.createdAt), updated_at: new Date(draft.audit.updatedAt), created_by: draft.audit.createdBy ? String(draft.audit.createdBy) : null, updated_by: draft.audit.updatedBy ? String(draft.audit.updatedBy) : null, archived_at: null }; }
//# sourceMappingURL=page-mapper.js.map