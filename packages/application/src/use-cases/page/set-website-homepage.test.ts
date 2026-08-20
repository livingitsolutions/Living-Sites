import { describe, expect, it } from "vitest";
import type { OrganizationId, Page, PageId, Slug, UserId, Website, WebsiteId } from "@livingsites/domain";
import { PageStatus, WebsiteStatus } from "@livingsites/domain";
import type { AuthorizationService, PageHomepagePersistence, WebsiteReader } from "@livingsites/application";
import { setWebsiteHomepage } from "./set-website-homepage.js";

const organizationId = "org_home" as OrganizationId;
const websiteId = "web_home" as WebsiteId;
const userId = "usr_editor" as UserId;
const now = "2026-08-20T00:00:00.000Z";
const audit = { createdAt: now, updatedAt: now } as Page["audit"];
const website = { id: websiteId, organizationId, name: "Site", slug: "site" as Slug, customDomain: null, fallbackDomain: "web-home.example.com", status: WebsiteStatus.Draft, publishedVersion: null, themeId: null, defaultLocale: "en-US", enabledLocales: ["en-US"], settings: {}, version: 1, audit, archivedAt: null } as unknown as Website;
const page = (overrides: Partial<Page> = {}): Page => ({ id: "page_target" as PageId, websiteId, title: "Landing", slug: "landing" as Slug, isHomepage: false, status: PageStatus.Published, publishedSnapshotId: "snapshot_1", sectionOrder: [], availableLocales: [], parentId: null, version: 3, audit, archivedAt: null, ...overrides });
const authorization = (allowed: boolean): AuthorizationService => ({ can: async () => allowed ? { allowed: true, source: "membership", role: "editor" } : { allowed: false, code: "permission_denied", reason: "Denied" } }) as AuthorizationService;
const websiteReader = (value: Website | null = website): WebsiteReader => ({ findById: async () => value, findByOrganizationAndSlug: async () => null, listForOrganization: async () => [], findByDomain: async () => null });

function deps(target: Page, persistence: PageHomepagePersistence, allowed = true) {
  return { authenticatedUser: { userId }, authorizationService: authorization(allowed), websiteReader: websiteReader(), pageReader: { findById: async () => target, findActiveBySlug: async () => null, listForWebsite: async () => [target] }, pageHomepagePersistence: persistence, clock: { now: () => new Date(now), nowIso: () => now } };
}

describe("setWebsiteHomepage", () => {
  it("authorizes, validates ownership, and delegates the atomic change", async () => {
    let received: Parameters<PageHomepagePersistence["setWebsiteHomepage"]>[0] | null = null;
    const target = page();
    const result = await setWebsiteHomepage({ organizationId, websiteId, pageId: target.id, expectedVersion: 3 }, deps(target, { setWebsiteHomepage: async (input) => { received = input; return { ok: true, value: { ...target, isHomepage: true, version: 4 } }; } }));
    expect(result.ok && result.value.isHomepage).toBe(true);
    expect(received).toMatchObject({ websiteId, pageId: target.id, expectedPageVersion: 3, event: { type: "website.homepage_changed", pageId: target.id } });
  });

  it("denies viewers and cross-Website Page ownership", async () => {
    const target = page();
    const persistence = { setWebsiteHomepage: async () => ({ ok: true as const, value: target }) };
    expect((await setWebsiteHomepage({ organizationId, websiteId, pageId: target.id, expectedVersion: 3 }, deps(target, persistence, false))).ok).toBe(false);
    expect((await setWebsiteHomepage({ organizationId, websiteId, pageId: target.id, expectedVersion: 3 }, deps(page({ websiteId: "web_other" as WebsiteId }), persistence))).ok).toBe(false);
  });

  it("rejects archived and already-selected Pages before persistence", async () => {
    let calls = 0;
    const persistence = { setWebsiteHomepage: async () => { calls += 1; return { ok: true as const, value: page() }; } };
    const archived = page({ status: PageStatus.Archived, archivedAt: now as Page["archivedAt"] });
    expect((await setWebsiteHomepage({ organizationId, websiteId, pageId: archived.id, expectedVersion: 3 }, deps(archived, persistence))).ok).toBe(false);
    const current = page({ isHomepage: true });
    expect((await setWebsiteHomepage({ organizationId, websiteId, pageId: current.id, expectedVersion: 3 }, deps(current, persistence))).ok).toBe(false);
    expect(calls).toBe(0);
  });

  it("surfaces optimistic concurrency conflicts", async () => {
    const target = page();
    const result = await setWebsiteHomepage({ organizationId, websiteId, pageId: target.id, expectedVersion: 2 }, deps(target, { setWebsiteHomepage: async () => ({ ok: false, error: { code: "concurrency_conflict", message: "Page changed since it was loaded." } }) }));
    expect(result).toMatchObject({ ok: false, error: { code: "concurrency_conflict" } });
  });
});
