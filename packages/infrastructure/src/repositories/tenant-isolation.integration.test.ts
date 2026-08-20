import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import type { OrganizationId, UserId, WebsiteId } from "@livingsites/domain";
import { createTestDatabaseHarness, type TestDatabaseHarness } from "../db/test-harness.js";
import { createTenantContextRunner, tenantDatabase, TenantContextDeniedError } from "../db/tenant-context.js";
import * as schema from "../db/schema.js";

const now = new Date("2026-08-19T00:00:00.000Z");
const orgA = "org_rls_a" as OrganizationId;
const orgB = "org_rls_b" as OrganizationId;
const userA = "usr_rls_a" as UserId;
const userB = "usr_rls_b" as UserId;
const superUser = "usr_rls_super" as UserId;
const websiteA = "web_rls_a" as WebsiteId;
const websiteA2 = "web_rls_a_2" as WebsiteId;
const websiteB = "web_rls_b" as WebsiteId;

describe("PostgreSQL tenant isolation", () => {
  let harness: TestDatabaseHarness;
  let isolatedClient: postgres.Sql;
  let isolatedDb: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    harness = await createTestDatabaseHarness();
    await harness.start();
    await harness.sqlClient`create role living_sites_test_runtime nologin`;
    await harness.sqlClient`grant usage on schema public, app_security to living_sites_test_runtime`;
    await harness.sqlClient`grant select, insert, update, delete on all tables in schema public to living_sites_test_runtime`;
    await harness.sqlClient`grant execute on all functions in schema app_security to living_sites_test_runtime`;
    await harness.sqlClient`grant living_sites_test_runtime to current_user`;
    isolatedClient = postgres(harness.connectionString, { max: 1 });
    await isolatedClient`set role living_sites_test_runtime`;
    isolatedDb = drizzle({ client: isolatedClient, schema });
  });

  afterAll(async () => {
    await isolatedClient.end();
    await harness.stop();
  });

  beforeEach(async () => {
    await harness.reset();
    await createTenantContextRunner(harness.db).run({ mode: "internal" }, async () => {
    const db = tenantDatabase(harness.db);
    await db.insert(schema.organizations).values([
      { id: orgA, name: "Org A", slug: "org-rls-a", billing_email: "a@example.com", created_at: now, updated_at: now },
      { id: orgB, name: "Org B", slug: "org-rls-b", billing_email: "b@example.com", created_at: now, updated_at: now },
    ]);
    await db.insert(schema.platformUsers).values([
      { id: userA, auth_subject_id: "auth_a", email: "user-a@example.com", display_name: "User A", created_at: now, updated_at: now },
      { id: userB, auth_subject_id: "auth_b", email: "user-b@example.com", display_name: "User B", created_at: now, updated_at: now },
      { id: superUser, auth_subject_id: "auth_super", email: "super@example.com", display_name: "Super", created_at: now, updated_at: now },
    ]);
    await db.insert(schema.memberships).values([
      { id: "mem_a", organization_id: orgA, user_id: userA, role: "owner", status: "active", version: 1, created_at: now, updated_at: now },
      { id: "mem_b", organization_id: orgB, user_id: userB, role: "owner", status: "active", version: 1, created_at: now, updated_at: now },
    ]);
    await db.insert(schema.platformSuperAdmins).values({ id: "super_admin", user_id: superUser, email: "super@example.com", singleton_key: 1, created_at: now });
    await db.insert(schema.websites).values([
      websiteRow(websiteA, orgA, "a"),
      websiteRow(websiteA2, orgA, "a-two"),
      websiteRow(websiteB, orgB, "b"),
    ]);
    await db.insert(schema.pages).values([
      pageRow("page_a", websiteA),
      pageRow("page_a_2", websiteA2),
      pageRow("page_b", websiteB),
    ]);
    await db.insert(schema.pageSections).values([
      sectionRow("section_a", "page_a", websiteA),
      sectionRow("section_b", "page_b", websiteB),
    ]);
    await db.insert(schema.pageSnapshots).values([
      snapshotRow("snapshot_a", "page_a", websiteA, orgA),
      snapshotRow("snapshot_b", "page_b", websiteB, orgB),
    ]);
    });
    await isolatedClient`reset app.context_mode`;
    await isolatedClient`reset app.user_id`;
    await isolatedClient`reset app.organization_id`;
    await isolatedClient`reset app.website_id`;
    await isolatedClient`reset app.tenant_authorized`;
  });

  it("fails closed without tenant context", async () => {
    expect(await isolatedDb.select().from(schema.organizations)).toHaveLength(0);
    expect(await isolatedDb.update(schema.websites).set({ name: "blocked" }).where(eq(schema.websites.id, websiteA)).returning()).toHaveLength(0);
  });

  it("prevents Org A from reading or mutating Org B rows", async () => {
    const runner = createTenantContextRunner(isolatedDb);
    await runner.run({ mode: "tenant", userId: userA, organizationId: orgA }, async () => {
      const db = tenantDatabase(isolatedDb);
      expect((await db.select().from(schema.organizations)).map((row) => row.id)).toEqual([orgA]);
      expect((await db.select().from(schema.memberships)).map((row) => row.organization_id)).toEqual([orgA]);
      expect((await db.select().from(schema.websites)).map((row) => row.organization_id)).toEqual([orgA, orgA]);
      expect(await db.update(schema.websites).set({ name: "blocked" }).where(eq(schema.websites.id, websiteB)).returning()).toHaveLength(0);
    });
  });

  it("enforces Website, Page, Section, and Snapshot scope while allowing same-tenant mutations", async () => {
    const runner = createTenantContextRunner(isolatedDb);
    await runner.run({ mode: "tenant", userId: userA, organizationId: orgA, websiteId: websiteA }, async () => {
      const db = tenantDatabase(isolatedDb);
      expect((await db.select().from(schema.websites)).map((row) => row.id)).toEqual([websiteA]);
      expect((await db.select().from(schema.pages)).map((row) => row.id)).toEqual(["page_a"]);
      expect((await db.select().from(schema.pageSections)).map((row) => row.id)).toEqual(["section_a"]);
      expect((await db.select().from(schema.pageSnapshots)).map((row) => row.id)).toEqual(["snapshot_a"]);
      expect(await db.update(schema.websites).set({ name: "Updated A" }).where(eq(schema.websites.id, websiteA)).returning()).toHaveLength(1);
      expect(await db.update(schema.pages).set({ title: "Blocked B" }).where(eq(schema.pages.id, "page_b")).returning()).toHaveLength(0);
    });
  });

  it("rejects an unapproved tenant context and permits explicit Platform Super Admin and internal contexts", async () => {
    const runner = createTenantContextRunner(isolatedDb);
    await expect(runner.run({ mode: "tenant", userId: userA, organizationId: orgB }, async () => true)).rejects.toBeInstanceOf(TenantContextDeniedError);
    await expect(runner.run({ mode: "tenant", userId: superUser, organizationId: orgB }, async () => tenantDatabase(isolatedDb).select().from(schema.websites))).resolves.toHaveLength(3);
    await expect(runner.run({ mode: "internal" }, async () => tenantDatabase(isolatedDb).select().from(schema.organizations))).resolves.toHaveLength(2);
  });
});

function websiteRow(id: WebsiteId, organizationId: OrganizationId, slug: string) {
  return { id, organization_id: organizationId, name: slug, slug, fallback_domain: `${slug}.livingsites.app`, status: "draft" as const, default_locale: "en-US", enabled_locales: ["en-US"], settings: { passwordProtection: null, searchEngineIndexing: true, socialDefaults: {}, headerScripts: [], footerScripts: [] }, version: 1, created_at: now, updated_at: now };
}

function pageRow(id: string, websiteId: WebsiteId) {
  return { id, website_id: websiteId, title: id, slug: id, status: "published" as const, published_snapshot_id: id.replace("page", "snapshot"), section_order: [], available_locales: [], version: 1, created_at: now, updated_at: now };
}

function sectionRow(id: string, pageId: string, websiteId: WebsiteId) {
  return { id, page_id: pageId, website_id: websiteId, section_type_id: "section-type:hero", sort_order: 0, props: { headline: id }, status: "active", created_at: now, updated_at: now };
}

function snapshotRow(id: string, pageId: string, websiteId: WebsiteId, organizationId: OrganizationId) {
  return { id, page_id: pageId, website_id: websiteId, organization_id: organizationId, revision_number: 1, page_metadata: { title: pageId, slug: pageId, path: `/${pageId}`, isHomepage: false }, sections: [], created_at: now, published_at: now, published_by: "test" };
}
