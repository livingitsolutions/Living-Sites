import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NetlifyDB } from "@netlify/database-dev";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import type { ISODateString, OrganizationId, Slug, UserId, WebsiteCreatedEvent, WebsiteId } from "@livingsites/domain";
import { createWebsiteDraft } from "@livingsites/domain";
import { NoopLogger } from "@livingsites/platform";
import * as schema from "../../db/schema.js";
import { applicationOutbox, organizations, websites } from "../../db/schema.js";
import { DrizzleWebsiteRepository } from "./drizzle-website-repository.js";
import { DrizzleWebsiteCreationPersistence } from "../outbox/drizzle-website-creation-persistence.js";

const orgA = "org_website_a" as OrganizationId;
const orgB = "org_website_b" as OrganizationId;
const now = "2026-08-19T00:00:00.000Z" as ISODateString;

function draft(id: string, organizationId = orgA, slug = "field-notes", domain: string | null = null) {
  return createWebsiteDraft({
    id: id as WebsiteId,
    organizationId,
    name: "Field Notes",
    slug: slug as Slug,
    fallbackDomain: `${id.replaceAll("_", "-")}.livingsites.app`,
    customDomain: domain,
    now,
    createdBy: "usr_owner" as UserId,
  });
}

function eventFor(id: WebsiteId, organizationId = orgA): WebsiteCreatedEvent {
  return { type: "website.created", occurredAt: now, eventScope: { scope: "organization", organizationId }, websiteId: id, slug: "field-notes" };
}

describe("DrizzleWebsiteRepository — Netlify Database", () => {
  let netlifyDB: NetlifyDB;
  let sqlClient: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let repository: DrizzleWebsiteRepository;

  beforeAll(async () => {
    netlifyDB = new NetlifyDB({ logger: () => {} });
    const connectionString = await netlifyDB.start();
    await netlifyDB.applyMigrations("./netlify/database/migrations");
    sqlClient = postgres(connectionString, { max: 1 });
    await sqlClient`select set_config('app.context_mode', 'internal', false)`;
    await sqlClient`select set_config('app.tenant_authorized', 'true', false)`;
    db = drizzle({ client: sqlClient, schema });
    repository = new DrizzleWebsiteRepository({ db, logger: new NoopLogger() });
  });

  afterAll(async () => {
    await sqlClient.end();
    await netlifyDB.stop();
  });

  beforeEach(async () => {
    await db.delete(applicationOutbox);
    await db.delete(websites);
    await db.delete(organizations);
    for (const id of [orgA, orgB]) {
      await db.insert(organizations).values({ id, name: id, slug: `${id}-slug`, billing_email: `${id}@example.com`, status: "active", feature_overrides: "[]", version: 1, created_at: new Date(now), updated_at: new Date(now) });
    }
  });

  it("executes the migration and creates a version-one aggregate", async () => {
    const result = await repository.create(draft("web_create"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.version).toBe(1);
    expect((await db.select().from(websites)).length).toBe(1);
  });

  it("finds by id, organization slug, domain, and organization list", async () => {
    await repository.create(draft("web_find", orgA, "field-notes", "Notes.Example.COM"));
    expect((await repository.findById("web_find" as WebsiteId))?.name).toBe("Field Notes");
    expect((await repository.findByOrganizationAndSlug(orgA, "field-notes"))?.id).toBe("web_find");
    expect((await repository.findByDomain("NOTES.EXAMPLE.COM."))?.id).toBe("web_find");
    expect(await repository.listForOrganization(orgA)).toHaveLength(1);
    expect(await repository.listForOrganization(orgB)).toHaveLength(0);
  });

  it("enforces organization-scoped slug and global domain uniqueness", async () => {
    expect((await repository.create(draft("web_a", orgA, "journal", "journal.example.com"))).ok).toBe(true);
    expect((await repository.create(draft("web_duplicate", orgA, "journal"))).ok).toBe(false);
    expect((await repository.create(draft("web_b", orgB, "journal"))).ok).toBe(true);
    expect((await repository.create(draft("web_domain", orgB, "other", "JOURNAL.EXAMPLE.COM"))).ok).toBe(false);
  });

  it("rejects mapper-invalid settings", async () => {
    await repository.create(draft("web_invalid"));
    await db.update(websites).set({ settings: { searchEngineIndexing: "yes" } }).where(eq(websites.id, "web_invalid"));
    expect(await repository.findById("web_invalid" as WebsiteId)).toBeNull();
  });

  it("commits Website and WebsiteCreated event together", async () => {
    const candidate = draft("web_atomic");
    const persistence = new DrizzleWebsiteCreationPersistence({ db, logger: new NoopLogger() });
    expect((await persistence.createWithEvent(candidate, eventFor(candidate.id))).ok).toBe(true);
    expect((await db.select().from(websites)).length).toBe(1);
    const events = await db.select().from(applicationOutbox);
    expect(events).toHaveLength(1);
    expect(events[0]?.organization_id).toBe(orgA);
    expect(events[0]?.website_id).toBe("web_atomic");
  });

  it("rolls back Website when outbox persistence fails", async () => {
    const candidate = draft("web_rollback");
    const persistence = new DrizzleWebsiteCreationPersistence({ db, logger: new NoopLogger(), beforeOutboxInsert: () => { throw new Error("forced outbox failure"); } });
    expect((await persistence.createWithEvent(candidate, eventFor(candidate.id))).ok).toBe(false);
    expect(await db.select().from(websites)).toHaveLength(0);
    expect(await db.select().from(applicationOutbox)).toHaveLength(0);
  });
});
