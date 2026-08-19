import type { AggregateVersion, ISODateString, LocaleCode, Page, PageDraft, PageId, Section, SectionId, SectionTypeId, Slug, UserId, WebsiteId } from "@livingsites/domain";
import { PageStatus } from "@livingsites/domain";
import type { InvalidPersistenceStateError } from "@livingsites/application";
import type { PageRow, PageSectionRow } from "./schema";

type MapperResult = { ok: true; value: Page } | { ok: false; error: InvalidPersistenceStateError };
export function rowToPage(row: PageRow, sectionRows: readonly PageSectionRow[] = []): MapperResult {
  if (!row.id || !row.website_id || !row.slug || row.version < 1) return { ok: false, error: { code: "invalid_persistence_state", message: "Page row is invalid." } };
  if (!Object.values(PageStatus).includes(row.status as PageStatus) || !Array.isArray(row.section_order) || !Array.isArray(row.available_locales)) return { ok: false, error: { code: "invalid_persistence_state", message: "Page row has invalid aggregate data." } };
  return { ok: true, value: { id: row.id as PageId, websiteId: row.website_id as WebsiteId, title: row.title, slug: row.slug as Slug,
    ...(row.description ? { description: row.description } : {}), isHomepage: row.is_homepage, status: row.status as PageStatus,
    publishedSnapshotId: row.published_snapshot_id, sectionOrder: row.section_order as SectionId[], sections: sectionRows.map(rowToSection), availableLocales: row.available_locales as LocaleCode[],
    parentId: row.parent_id as PageId | null, version: row.version as AggregateVersion,
    audit: { createdAt: row.created_at.toISOString() as ISODateString, updatedAt: row.updated_at.toISOString() as ISODateString, ...(row.created_by ? { createdBy: row.created_by as UserId } : {}), ...(row.updated_by ? { updatedBy: row.updated_by as UserId } : {}) },
    archivedAt: row.archived_at ? row.archived_at.toISOString() as ISODateString : null } };
}
function rowToSection(row: PageSectionRow): Section {
  return { id: row.id as SectionId, pageId: row.page_id as PageId, websiteId: row.website_id as WebsiteId, sectionTypeId: row.section_type_id as SectionTypeId, props: row.props as Record<string, unknown>, sortOrder: row.sort_order, status: row.status as "active" | "archived", audit: { createdAt: row.created_at.toISOString() as ISODateString, updatedAt: row.updated_at.toISOString() as ISODateString, ...(row.created_by ? { createdBy: row.created_by as UserId } : {}), ...(row.updated_by ? { updatedBy: row.updated_by as UserId } : {}) } };
}
export function pageDraftToInsert(draft: PageDraft) { return { id: String(draft.id), website_id: String(draft.websiteId), title: draft.title, slug: String(draft.slug), description: draft.description ?? null, is_homepage: draft.isHomepage, status: draft.status, published_snapshot_id: draft.publishedSnapshotId, section_order: [...draft.sectionOrder], available_locales: [...draft.availableLocales], parent_id: draft.parentId ? String(draft.parentId) : null, version: 1, created_at: new Date(draft.audit.createdAt), updated_at: new Date(draft.audit.updatedAt), created_by: draft.audit.createdBy ? String(draft.audit.createdBy) : null, updated_by: draft.audit.updatedBy ? String(draft.audit.updatedBy) : null, archived_at: null }; }
