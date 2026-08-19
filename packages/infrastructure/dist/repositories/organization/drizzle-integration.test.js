/**
 * Database integration test suite for DrizzleOrganizationRepository.
 *
 * Uses @netlify/database-dev and requires no external connection variable.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { NetlifyDB } from "@netlify/database-dev";
import { createOrganizationDraft } from "@livingsites/domain";
import { NoopLogger } from "@livingsites/platform";
import { DrizzleOrganizationRepository } from "./drizzle-organization-repository";
import { organizations } from "../../db/schema";
import * as schema from "../../db/schema";
import { runRepositoryContractTests } from "@livingsites/test-support";
function makeDraft(overrides) {
    return createOrganizationDraft({
        id: (overrides.id ?? `org_test_${Date.now()}`),
        name: overrides.name ?? "Integration Test Org",
        slug: (overrides.slug ?? `integration-test-${Date.now()}`),
        billingEmail: overrides.billingEmail ?? "integration@test.com",
        planId: null,
        now: "2026-01-01T00:00:00.000Z",
    });
}
describe("DrizzleOrganizationRepository — database integration", () => {
    let netlifyDB;
    let db;
    let sql;
    let repo;
    beforeAll(async () => {
        netlifyDB = new NetlifyDB({ logger: () => { } });
        const connectionString = await netlifyDB.start();
        await netlifyDB.applyMigrations("./netlify/database/migrations");
        sql = postgres(connectionString);
        db = drizzle({ client: sql, schema });
        repo = new DrizzleOrganizationRepository({ db, logger: new NoopLogger() });
    });
    afterAll(async () => {
        if (sql)
            await sql.end();
        if (netlifyDB)
            await netlifyDB.stop();
    });
    beforeEach(async () => {
        await db.delete(organizations);
    });
    runRepositoryContractTests("DrizzleOrganizationRepository", () => ({
        reader: repo,
        creator: repo,
        cleanup: async () => {
            await db.delete(organizations);
        },
    }));
    it("migration applies successfully (table exists)", async () => {
        const rows = await db.select().from(organizations);
        expect(Array.isArray(rows)).toBe(true);
    });
    it("raw database exceptions do not escape create", async () => {
        const draft = makeDraft({ slug: "exception-test" });
        await repo.create(draft);
        const result = await repo.create(draft);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(typeof result.error.code).toBe("string");
        }
    });
    it("mapper rejects an invalid persisted version", async () => {
        const id = "org_invalid_version";
        await db.insert(organizations).values({
            id,
            name: "Invalid Version",
            slug: "invalid-version",
            billing_email: "invalid@test.com",
            plan_id: null,
            status: "active",
            feature_overrides: "[]",
            version: 0,
            created_at: new Date(),
            updated_at: new Date(),
            created_by: null,
            updated_by: null,
            deleted_at: null,
        });
        const found = await repo.findById(id);
        expect(found).toBeNull();
    });
    it("mapper rejects malformed feature_overrides JSON", async () => {
        const id = "org_malformed_json";
        await db.insert(organizations).values({
            id,
            name: "Malformed JSON",
            slug: "malformed-json",
            billing_email: "malformed@test.com",
            plan_id: null,
            status: "active",
            feature_overrides: "not valid json{{{",
            version: 1,
            created_at: new Date(),
            updated_at: new Date(),
            created_by: null,
            updated_by: null,
            deleted_at: null,
        });
        const found = await repo.findById(id);
        expect(found).toBeNull();
    });
});
//# sourceMappingURL=drizzle-integration.test.js.map