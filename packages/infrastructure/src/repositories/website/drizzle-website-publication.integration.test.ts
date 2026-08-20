import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { OrganizationId, UserId, VersionString, WebsiteId } from "@livingsites/domain";
import { NoopLogger } from "@livingsites/platform";
import { createTestDatabaseHarness, type TestDatabaseHarness } from "../../db/test-harness.js";
import { applicationOutbox, organizations, pageSnapshots, pages, websites } from "../../db/schema.js";
import { DrizzleWebsitePublicationRepository } from "./drizzle-website-publication-repository.js";

const now = "2026-08-19T00:00:00.000Z";
const organizationId = "org_publication" as OrganizationId;
const websiteId = "web_publication" as WebsiteId;
const userId = "usr_publication" as UserId;

describe("DrizzleWebsitePublicationRepository", () => {
  let harness: TestDatabaseHarness;

  beforeAll(async () => { harness = await createTestDatabaseHarness(); await harness.start(); });
  afterAll(async () => { await harness.stop(); });
  beforeEach(async () => {
    await harness.reset();
    await harness.db.insert(organizations).values({ id: organizationId, name: "Publication", slug: "publication", billing_email: "publication@example.com", created_at: new Date(now), updated_at: new Date(now) });
    await harness.db.insert(websites).values({ id: websiteId, organization_id: organizationId, name: "Publication", slug: "publication", fallback_domain: "publication.livingsites.app", status: "draft", default_locale: "en-US", enabled_locales: ["en-US"], settings: { passwordProtection: null, searchEngineIndexing: true, socialDefaults: {}, headerScripts: [], footerScripts: [] }, version: 1, created_at: new Date(now), updated_at: new Date(now) });
    await harness.db.insert(pages).values({ id: "page_publication", website_id: websiteId, title: "Home", slug: "home", is_homepage: true, status: "published", published_snapshot_id: "snapshot_publication", section_order: [], available_locales: [], version: 2, created_at: new Date(now), updated_at: new Date(now) });
    await harness.db.insert(pageSnapshots).values({ id: "snapshot_publication", page_id: "page_publication", website_id: websiteId, organization_id: organizationId, revision_number: 1, page_metadata: { title: "Home", slug: "home", path: "/", isHomepage: true }, sections: [], created_at: new Date(now), published_at: new Date(now), published_by: userId });
  });

  it("publishes and unpublishes atomically without deleting snapshots", async () => {
    const repository = new DrizzleWebsitePublicationRepository({ db: harness.db, logger: new NoopLogger() });
    const published = await repository.publishWithEvent({ websiteId, expectedVersion: 1, publishedVersion: "1.0.1" as VersionString, changedAt: now, changedBy: userId, event: { type: "website.published", occurredAt: now as never, eventScope: { scope: "website", organizationId, websiteId }, publishedVersion: "1.0.1" as VersionString } });
    expect(published.ok && published.value.status).toBe("published");
    const unpublished = await repository.unpublishWithEvent({ websiteId, expectedVersion: 2, changedAt: now, changedBy: userId, event: { type: "website.unpublished", occurredAt: now as never, eventScope: { scope: "website", organizationId, websiteId }, websiteVersion: 3 } });
    expect(unpublished.ok && unpublished.value.status).toBe("unpublished");
    expect(await harness.db.select().from(pageSnapshots)).toHaveLength(1);
    expect((await harness.db.select().from(applicationOutbox)).map((row) => row.event_type)).toEqual(["website.published", "website.unpublished"]);
  });

  it("rolls back Website status when the outbox insert fails", async () => {
    const repository = new DrizzleWebsitePublicationRepository({ db: harness.db, logger: new NoopLogger(), beforeOutboxInsert: () => { throw new Error("forced outbox failure"); } });
    expect((await repository.publishWithEvent({ websiteId, expectedVersion: 1, publishedVersion: "1.0.1" as VersionString, changedAt: now, changedBy: userId, event: { type: "website.published", occurredAt: now as never, eventScope: { scope: "website", organizationId, websiteId }, publishedVersion: "1.0.1" as VersionString } })).ok).toBe(false);
    expect((await harness.db.select().from(websites))[0]?.status).toBe("draft");
    expect(await harness.db.select().from(applicationOutbox)).toHaveLength(0);
  });
});
