import { describe, expect, it } from "vitest";
import type { AggregateVersion, OrganizationId, Page, PageId, Section, SectionId, Slug, UserId, Website, WebsiteId } from "@livingsites/domain";
import { PageStatus } from "@livingsites/domain";
import { DeterministicIdGenerator, FakeClock } from "@livingsites/platform";
import type { AuthorizationService, PageRepository } from "../../index.js";
import { SECTION_TYPES, validateSectionProps } from "../../section-types/index.js";
import { addSection, duplicateSection, getPageBuilderState, removeSection, reorderSections, updateSection, type BuilderDeps } from ".";

const organizationId = "org_builder" as OrganizationId; const websiteId = "web_builder" as WebsiteId; const pageId = "page_builder" as PageId; const userId = "usr_builder" as UserId;
const website = { id: websiteId, organizationId } as Website;
const page = (): Page => ({ id: pageId, websiteId, title: "Landing", slug: "landing" as Slug, isHomepage: false, status: PageStatus.Draft, publishedSnapshotId: null, sectionOrder: [], sections: [], availableLocales: [], parentId: null, version: 1 as AggregateVersion, audit: { createdAt: "2026-08-19T00:00:00.000Z" as never, updatedAt: "2026-08-19T00:00:00.000Z" as never }, archivedAt: null });

class MemoryPages implements PageRepository {
  current = page(); failNext = false;
  async findById(id: PageId) { return id === this.current.id ? this.current : null; }
  async findActiveBySlug() { return null; }
  async listForWebsite() { return [this.current]; }
  async createWithEvent() { return { ok: true as const, value: this.current }; }
  async updateDetails() { return { ok: true as const, value: this.current }; }
  async archiveWithEvent() { return { ok: true as const, value: this.current }; }
  async restoreWithEvent() { return { ok: true as const, value: this.current }; }
  async saveBuilder(input: { sections: readonly Section[]; expectedVersion: AggregateVersion }) {
    if (this.failNext || input.expectedVersion !== this.current.version) return { ok: false as const, error: { aggregateId: pageId, expectedVersion: input.expectedVersion, actualVersion: this.current.version } };
    this.current = { ...this.current, sections: input.sections.map((section, index) => ({ ...section, sortOrder: index })), sectionOrder: input.sections.map((section) => section.id), version: (Number(this.current.version) + 1) as AggregateVersion };
    return { ok: true as const, value: this.current };
  }
}

const authorization = (allowed: boolean) => ({ can: async () => allowed ? { allowed: true as const } : { allowed: false as const, reason: "Denied" } }) as unknown as AuthorizationService;
const deps = (repository: MemoryPages, allowed = true, orgWebsite = website): BuilderDeps => ({ authenticatedUser: { userId }, authorizationService: authorization(allowed), websiteReader: { findById: async () => orgWebsite, findActiveBySlug: async () => null, listForOrganization: async () => [] }, pageReader: repository, pageMutationPersistence: repository, clock: new FakeClock(Date.parse("2026-08-19T12:00:00Z")), idGenerator: new DeterministicIdGenerator() });
const context = { organizationId, websiteId, pageId, expectedVersion: 1 as AggregateVersion };

describe("registered SectionTypes", () => {
  it.each(SECTION_TYPES.map((type) => [type.name, type]))("validates defaults for %s", (_, type) => expect(validateSectionProps(type, type.defaultProps).ok).toBe(true));
  it("rejects unsupported and malformed props", () => { expect(SECTION_TYPES).toHaveLength(6); expect(validateSectionProps(SECTION_TYPES[0]!, { arbitraryHtml: "<script>" }).ok).toBe(false); });
});

describe("Page Builder use cases", () => {
  it("adds, updates, duplicates, reorders, and removes while incrementing Page.version", async () => {
    const repository = new MemoryPages(); const dependencies = deps(repository);
    const added = await addSection({ ...context, sectionTypeKey: "hero" }, dependencies); expect(added.ok && added.value.page.version).toBe(2); const heroId = repository.current.sections[0]!.id;
    const updated = await updateSection({ ...context, expectedVersion: 2, sectionId: heroId, props: { headline: "New", subheading: "Copy", ctaLabel: "Go", ctaUrl: "/go" } }, dependencies); expect(updated.ok && updated.value.sections[0]!.props.headline).toBe("New");
    const duplicated = await duplicateSection({ ...context, expectedVersion: 3, sectionId: heroId }, dependencies); expect(duplicated.ok && duplicated.value.sections).toHaveLength(2); const duplicateId = repository.current.sections[1]!.id;
    const reordered = await reorderSections({ ...context, expectedVersion: 4, sectionIds: [duplicateId, heroId] }, dependencies); expect(reordered.ok && reordered.value.sections[0]!.id).toBe(duplicateId);
    const removed = await removeSection({ ...context, expectedVersion: 5, sectionId: heroId }, dependencies); expect(removed.ok && removed.value.page.version).toBe(6); expect(repository.current.sections).toHaveLength(1);
  });
  it("rejects unknown types, invalid props, cross-page ids, and invalid order", async () => { const repository = new MemoryPages(); const dependencies = deps(repository); expect((await addSection({ ...context, sectionTypeKey: "html" }, dependencies))).toMatchObject({ ok: false, error: { code: "invalid_section_type" } }); expect((await addSection({ ...context, sectionTypeKey: "hero", props: {} }, dependencies))).toMatchObject({ ok: false, error: { code: "invalid_props" } }); expect((await removeSection({ ...context, sectionId: "section_other" as SectionId }, dependencies))).toMatchObject({ ok: false, error: { code: "cross_page_section" } }); expect((await reorderSections({ ...context, sectionIds: ["section_other" as SectionId] }, dependencies))).toMatchObject({ ok: false, error: { code: "invalid_order" } }); });
  it("denies cross-org access and exposes Viewer state as read-only", async () => { const repository = new MemoryPages(); expect((await addSection({ ...context, sectionTypeKey: "hero" }, deps(repository, true, { ...website, organizationId: "org_other" as OrganizationId }))).ok).toBe(false); const viewer = await getPageBuilderState(context, deps(repository, false)); expect(viewer).toMatchObject({ ok: false, error: { code: "unauthorized" } }); const readOnlyAuth = { can: async (request: { permission: string }) => request.permission === "page.read" ? { allowed: true as const } : { allowed: false as const, reason: "Viewer" } } as unknown as AuthorizationService; const viewerDeps = { ...deps(repository), authorizationService: readOnlyAuth }; const state = await getPageBuilderState(context, viewerDeps); expect(state.ok && state.value.canEdit).toBe(false); });
  it("reports optimistic concurrency conflicts without overwriting", async () => { const repository = new MemoryPages(); repository.failNext = true; const result = await addSection({ ...context, sectionTypeKey: "hero" }, deps(repository)); expect(result).toMatchObject({ ok: false, error: { code: "concurrency_conflict" } }); expect(repository.current.sections).toHaveLength(0); });
});
