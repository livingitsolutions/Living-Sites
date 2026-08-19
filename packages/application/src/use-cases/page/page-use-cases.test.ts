import { describe, expect, it } from "vitest";
import type { OrganizationId, Page, PageId, Slug, UserId, Website, WebsiteId } from "@livingsites/domain";
import { PageStatus, WebsiteStatus } from "@livingsites/domain";
import type { AuthorizationService, PageRepository, WebsiteReader } from "@livingsites/application";
import { createPage, getPage, listWebsitePages, updatePageDetails } from "@livingsites/application";

const clock = { now: () => new Date("2026-08-19T00:00:00.000Z"), nowIso: () => "2026-08-19T00:00:00.000Z" };
const idGenerator = { generate: () => "id_1", generatePrefixed: (prefix: string) => `${prefix}_1` };

const orgA = "org_a" as OrganizationId; const orgB = "org_b" as OrganizationId; const websiteId = "web_a" as WebsiteId; const userId = "usr_a" as UserId;
const audit = { createdAt: "2026-08-19T00:00:00.000Z", updatedAt: "2026-08-19T00:00:00.000Z" } as Page["audit"];
const website: Website = { id: websiteId, organizationId: orgA, name: "Site", slug: "site" as Slug, customDomain: null, fallbackDomain: "site.example.com", status: WebsiteStatus.Draft, publishedVersion: null, themeId: null, defaultLocale: "en-US" as never, enabledLocales: ["en-US" as never], settings: { passwordProtection: null, searchEngineIndexing: true, socialDefaults: {}, headerScripts: [], footerScripts: [] }, version: 1, audit, archivedAt: null };
const page: Page = { id: "page_1" as PageId, websiteId, title: "About", slug: "about" as Slug, isHomepage: false, status: PageStatus.Draft, publishedSnapshotId: null, sectionOrder: [], availableLocales: [], parentId: null, version: 1, audit, archivedAt: null };
const authorization = (allowed: boolean) => ({ can: async () => allowed ? { allowed: true, source: "membership", role: "editor" } : { allowed: false, code: "permission_denied", reason: "Denied" } }) as unknown as AuthorizationService;
const websiteReader = (value: Website | null): WebsiteReader => ({ findById: async () => value, findByOrganizationAndSlug: async () => null, listForOrganization: async () => [], findByDomain: async () => null });

describe("Page use cases", () => {
  it("denies cross-organization Website ownership even after authorization", async () => {
    const result = await listWebsitePages({ organizationId: orgB, websiteId }, { authenticatedUser: { userId }, authorizationService: authorization(true), websiteReader: websiteReader(website), pageReader: { findById: async () => null, findActiveBySlug: async () => null, listForWebsite: async () => [] } });
    expect(result).toEqual({ ok: false, error: { code: "website_not_found", message: "Website was not found in this Organization." } });
  });

  it("denies a guessed Website id and keeps viewers read-only", async () => {
    const deps = { authenticatedUser: { userId }, authorizationService: authorization(false), websiteReader: websiteReader(null), pageReader: { findById: async () => page, findActiveBySlug: async () => null, listForWebsite: async () => [page] } };
    expect((await getPage({ organizationId: orgA, websiteId, pageId: page.id }, deps)).ok).toBe(false);
    const created = await createPage({ organizationId: orgA, websiteId, title: "New", slug: "new" }, { ...deps, pageCreationPersistence: { createWithEvent: async () => ({ ok: true, value: page }) }, clock, idGenerator });
    expect(created.ok).toBe(false);
  });

  it("creates version one and surfaces optimistic concurrency conflicts", async () => {
    const repository: PageRepository = { findById: async () => page, findActiveBySlug: async () => null, listForWebsite: async () => [page], createWithEvent: async (draft) => ({ ok: true, value: { ...draft, version: 1 } as Page }), updateDetails: async (input) => ({ ok: false, error: { aggregateId: String(input.pageId), expectedVersion: input.expectedVersion, actualVersion: 2 } }), archiveWithEvent: async () => ({ ok: true, value: page }), restoreWithEvent: async () => ({ ok: true, value: page }) };
    const common = { authenticatedUser: { userId }, authorizationService: authorization(true), websiteReader: websiteReader(website), pageReader: repository, clock };
    const created = await createPage({ organizationId: orgA, websiteId, title: "Contact", slug: "Contact" }, { ...common, pageCreationPersistence: repository, idGenerator });
    expect(created.ok && created.value.version).toBe(1);
    const updated = await updatePageDetails({ organizationId: orgA, websiteId, pageId: page.id, title: "About us", slug: "about", expectedVersion: 1 }, { ...common, pageMutationPersistence: repository });
    expect(updated).toMatchObject({ ok: false, error: { code: "concurrency_conflict" } });
  });
});
