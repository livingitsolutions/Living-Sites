import { describe, expect, it } from "vitest";
import type { OrganizationId, Page, PageId, PageSnapshot, Slug, UserId, Website, WebsiteId } from "@livingsites/domain";
import { PageStatus, WebsiteStatus } from "@livingsites/domain";
import { inspectPagePublication, listPagePublicationHistory } from "./page-publication-history.js";
import { rollbackPagePublication } from "./rollback-page-publication.js";

const organizationId = "org_a" as OrganizationId;
const websiteId = "web_a" as WebsiteId;
const pageId = "page_a" as PageId;
const userId = "usr_a" as UserId;
const audit = { createdAt: "2026-08-20T10:00:00.000Z", updatedAt: "2026-08-20T10:00:00.000Z" } as Page["audit"];
const website = { id: websiteId, organizationId, status: WebsiteStatus.Unpublished } as Website;
const page = { id: pageId, websiteId, title: "Home", slug: "home" as Slug, isHomepage: true, status: PageStatus.Published, publishedSnapshotId: "snapshot_3", sectionOrder: [], sections: [], availableLocales: [], parentId: null, version: 7, audit, archivedAt: null } as Page;
const snapshot = (revisionNumber: number, headline = `Revision ${revisionNumber}`): PageSnapshot => ({ id: `snapshot_${revisionNumber}`, pageId, websiteId, organizationId, revisionNumber, page: { title: "Home", slug: "home", path: "/", isHomepage: true }, sections: [{ sectionId: `section_${revisionNumber}` as never, sectionTypeId: "section-type:hero", props: { headline, subheading: "Safe", ctaLabel: "Open", ctaUrl: "/" }, sortOrder: 0 }], createdAt: `2026-08-2${revisionNumber}T10:00:00.000Z` as never, publishedAt: `2026-08-2${revisionNumber}T10:00:00.000Z` as never, publishedBy: `publisher_${revisionNumber}` });
const snapshots = [snapshot(3), snapshot(2), snapshot(1)];
const queryDeps = (overrides: Record<string, unknown> = {}) => ({ authenticatedUser: { userId }, authorizationService: { can: async () => ({ allowed: true }) }, websiteReader: { findById: async () => website }, pageReader: { findById: async () => page }, pageSnapshotReader: { listForPage: async () => snapshots, findById: async (id: string) => snapshots.find((entry) => entry.id === id) ?? null, findByRevision: async (_: PageId, revision: number) => snapshots.find((entry) => entry.revisionNumber === revision) ?? null }, ...overrides }) as never;

describe("Page publication history", () => {
  it("lists newest-first DTOs and identifies the current snapshot", async () => { const result = await listPagePublicationHistory({ organizationId, websiteId, pageId }, queryDeps()); expect(result.ok && result.value.map((item) => item.revisionNumber)).toEqual([3, 2, 1]); expect(result.ok && result.value.filter((item) => item.isCurrent).map((item) => item.snapshotId)).toEqual(["snapshot_3"]); });
  it("inspects the requested immutable snapshot instead of current draft sections", async () => { const result = await inspectPagePublication({ organizationId, websiteId, pageId, snapshotId: "snapshot_1" }, queryDeps({ pageReader: { findById: async () => ({ ...page, sections: [{ props: { headline: "Current draft" } }] }) } })); expect(result.ok && result.value.sections[0]?.props.headline).toBe("Revision 1"); });
  it("denies viewers and cross-organization ownership", async () => { expect((await listPagePublicationHistory({ organizationId, websiteId, pageId }, queryDeps({ authorizationService: { can: async () => ({ allowed: false, reason: "Viewer cannot publish" }) } }))).ok).toBe(false); expect((await inspectPagePublication({ organizationId: "org_b" as OrganizationId, websiteId, pageId, snapshotId: "snapshot_1" }, queryDeps())).ok).toBe(false); });
});

describe("RollbackPagePublication", () => {
  it("uses page.publish, preserves an unpublished Website, and requests a new snapshot", async () => { let persisted: Record<string, unknown> | null = null; const result = await rollbackPagePublication({ organizationId, websiteId, pageId, targetRevisionNumber: 1, expectedVersion: 7 }, queryDeps({ pageRollbackPersistence: { rollback: async (input: Record<string, unknown>) => { persisted = input; return { ok: true, value: { ...snapshot(1), id: String(input.newSnapshotId), revisionNumber: 4, publishedAt: String(input.rolledBackAt), createdAt: String(input.rolledBackAt), publishedBy: String(input.rolledBackBy) } }; } }, clock: { nowIso: () => "2026-08-20T12:00:00.000Z" }, idGenerator: { generatePrefixed: () => "snapshot_4" } })); expect(result.ok && result.value.revisionNumber).toBe(4); expect(persisted).toMatchObject({ targetRevisionNumber: 1, expectedPageVersion: 7, newSnapshotId: "snapshot_4" }); expect(website.status).toBe(WebsiteStatus.Unpublished); });
  it("rejects stale versions and viewers before persistence", async () => { let called = false; const persistence = { rollback: async () => { called = true; throw new Error("unexpected"); } }; expect((await rollbackPagePublication({ organizationId, websiteId, pageId, targetRevisionNumber: 1, expectedVersion: 6 }, queryDeps({ pageRollbackPersistence: persistence }))).ok).toBe(false); expect((await rollbackPagePublication({ organizationId, websiteId, pageId, targetRevisionNumber: 1, expectedVersion: 7 }, queryDeps({ authorizationService: { can: async () => ({ allowed: false, reason: "Denied" }) }, pageRollbackPersistence: persistence }))).ok).toBe(false); expect(called).toBe(false); });
});
