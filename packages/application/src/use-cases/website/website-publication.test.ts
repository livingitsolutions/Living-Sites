import { describe, expect, it } from "vitest";
import type { AggregateVersion, OrganizationId, Page, UserId, Website, WebsiteId } from "@livingsites/domain";
import { PageStatus, WebsiteStatus } from "@livingsites/domain";
import type { AuthorizationService, PageReader, WebsitePublicationPersistence, WebsiteReader } from "@livingsites/application";
import { publishWebsite } from "./publish-website/index.js";
import { unpublishWebsite } from "./unpublish-website/index.js";

const organizationId = "org_a" as OrganizationId;
const websiteId = "web_a" as WebsiteId;
const userId = "usr_a" as UserId;
const website = { id: websiteId, organizationId, status: WebsiteStatus.Draft, version: 3, archivedAt: null } as Website;
const publishedPage = { id: "page_a", websiteId, status: PageStatus.Published, publishedSnapshotId: "snapshot_a", archivedAt: null } as Page;
const authorizationService = { can: async () => ({ allowed: true }) } as unknown as AuthorizationService;
const clock = { nowIso: () => "2026-08-19T12:00:00.000Z" } as never;

function websiteReader(value: Website | null = website): WebsiteReader {
  return { findById: async () => value, findByOrganizationAndSlug: async () => null, listForOrganization: async () => value ? [value] : [], findByDomain: async () => value };
}

function pageReader(pages: readonly Page[] = [publishedPage]): PageReader {
  return { findById: async () => pages[0] ?? null, findActiveBySlug: async () => pages[0] ?? null, listForWebsite: async () => pages };
}

describe("Website publication use cases", () => {
  it("publishes a ready Website with an authorized durable event", async () => {
    let captured: Parameters<WebsitePublicationPersistence["publishWithEvent"]>[0] | null = null;
    const persistence: WebsitePublicationPersistence = {
      publishWithEvent: async (input) => { captured = input; return { ok: true, value: { ...website, status: WebsiteStatus.Published, version: 4 } as Website }; },
      unpublishWithEvent: async () => ({ ok: false, error: { code: "persistence_error", message: "unused" } }),
    };
    const result = await publishWebsite({ organizationId, websiteId, expectedVersion: 3 as AggregateVersion }, { authenticatedUser: { userId }, authorizationService, websiteReader: websiteReader(), pageReader: pageReader(), websitePublicationPersistence: persistence, clock });
    expect(result.ok && result.value.status).toBe(WebsiteStatus.Published);
    expect(captured?.event.type).toBe("website.published");
    expect(captured?.publishedVersion).toBe("1.0.3");
  });

  it("requires a published Page snapshot and rejects stale or cross-Organization Websites", async () => {
    const persistence = { publishWithEvent: async () => ({ ok: true, value: website }), unpublishWithEvent: async () => ({ ok: true, value: website }) } as WebsitePublicationPersistence;
    expect((await publishWebsite({ organizationId, websiteId, expectedVersion: 3 as AggregateVersion }, { authenticatedUser: { userId }, authorizationService, websiteReader: websiteReader(), pageReader: pageReader([]), websitePublicationPersistence: persistence, clock })).ok).toBe(false);
    expect((await publishWebsite({ organizationId, websiteId, expectedVersion: 2 as AggregateVersion }, { authenticatedUser: { userId }, authorizationService, websiteReader: websiteReader(), pageReader: pageReader(), websitePublicationPersistence: persistence, clock })).ok).toBe(false);
    expect((await publishWebsite({ organizationId: "org_b" as OrganizationId, websiteId, expectedVersion: 3 as AggregateVersion }, { authenticatedUser: { userId }, authorizationService, websiteReader: websiteReader(), pageReader: pageReader(), websitePublicationPersistence: persistence, clock })).ok).toBe(false);
  });

  it("unpublishes without changing Page snapshots", async () => {
    let captured: Parameters<WebsitePublicationPersistence["unpublishWithEvent"]>[0] | null = null;
    const publishedWebsite = { ...website, status: WebsiteStatus.Published } as Website;
    const persistence: WebsitePublicationPersistence = {
      publishWithEvent: async () => ({ ok: false, error: { code: "persistence_error", message: "unused" } }),
      unpublishWithEvent: async (input) => { captured = input; return { ok: true, value: { ...publishedWebsite, status: WebsiteStatus.Unpublished, version: 4 } as Website }; },
    };
    const result = await unpublishWebsite({ organizationId, websiteId, expectedVersion: 3 as AggregateVersion }, { authenticatedUser: { userId }, authorizationService, websiteReader: websiteReader(publishedWebsite), websitePublicationPersistence: persistence, clock });
    expect(result.ok && result.value.status).toBe(WebsiteStatus.Unpublished);
    expect(captured?.event.type).toBe("website.unpublished");
  });

  it("denies publish and unpublish when the Website publish permission is absent", async () => {
    let persistenceCalls = 0;
    const deniedAuthorization = { can: async () => ({ allowed: false, reason: "Website publish permission is required." }) } as unknown as AuthorizationService;
    const persistence: WebsitePublicationPersistence = {
      publishWithEvent: async () => { persistenceCalls += 1; return { ok: true, value: website }; },
      unpublishWithEvent: async () => { persistenceCalls += 1; return { ok: true, value: website }; },
    };

    const publishResult = await publishWebsite({ organizationId, websiteId, expectedVersion: 3 as AggregateVersion }, { authenticatedUser: { userId }, authorizationService: deniedAuthorization, websiteReader: websiteReader(), pageReader: pageReader(), websitePublicationPersistence: persistence, clock });
    const unpublishResult = await unpublishWebsite({ organizationId, websiteId, expectedVersion: 3 as AggregateVersion }, { authenticatedUser: { userId }, authorizationService: deniedAuthorization, websiteReader: websiteReader({ ...website, status: WebsiteStatus.Published } as Website), websitePublicationPersistence: persistence, clock });

    expect(publishResult).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(unpublishResult).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(persistenceCalls).toBe(0);
  });
});
