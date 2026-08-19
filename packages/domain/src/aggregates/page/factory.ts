import type { Slug } from "../../shared/index.js";
import { PageStatus } from "../../page/index.js";
import { PAGE_DRAFT_VERSION, type CreatePageDraftInput, type PageDraft } from "./draft.js";

export function normalizePageSlug(value: string): Slug {
  const normalized = value.trim().toLowerCase().replace(/^\/+|\/+$/g, "").replace(/\s+/g, "-");
  if (!normalized || normalized.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(normalized)) throw new Error("Page slug must contain lowercase URL segments separated by single dashes.");
  return normalized as Slug;
}

export function createPageDraft(input: CreatePageDraftInput): PageDraft {
  const title = input.title.trim();
  if (!title || title.length > 200) throw new Error("Page title must contain 1 to 200 characters.");
  return { id: input.id, websiteId: input.websiteId, slug: normalizePageSlug(String(input.slug)), title,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}), isHomepage: input.isHomepage ?? false,
    status: PageStatus.Draft, publishedSnapshotId: null, sectionOrder: [], sections: [], availableLocales: [], parentId: input.parentId ?? null,
    version: PAGE_DRAFT_VERSION, audit: { createdAt: input.now, updatedAt: input.now, ...(input.createdBy ? { createdBy: input.createdBy, updatedBy: input.createdBy } : {}) }, archivedAt: null };
}
