import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { NetlifyDB } from "@netlify/database-dev";
import { NoopLogger } from "@livingsites/platform";
import { DrizzleMembershipRepository } from "./drizzle-membership-repository";
import { DrizzleUserRepository } from "../user/drizzle-user-repository";
import { DrizzleOrganizationRepository } from "../organization/drizzle-organization-repository";
import { memberships, organizations, platformUsers } from "../../db/schema";
import * as schema from "../../db/schema";
import { runMembershipRepositoryContractTests } from "@livingsites/test-support";
import { createMembershipDraft, createOrganizationDraft, createUserDraft, } from "@livingsites/domain";
describe("DrizzleMembershipRepository — database integration", () => {
    let netlifyDB;
    let db;
    let sql;
    let repo;
    let userRepo;
    let orgRepo;
    beforeAll(async () => {
        netlifyDB = new NetlifyDB({ logger: () => { } });
        const connectionString = await netlifyDB.start();
        await netlifyDB.applyMigrations("./netlify/database/migrations");
        sql = postgres(connectionString);
        db = drizzle({ client: sql, schema });
        const logger = new NoopLogger();
        repo = new DrizzleMembershipRepository({ db, logger });
        userRepo = new DrizzleUserRepository({ db, logger });
        orgRepo = new DrizzleOrganizationRepository({ db, logger });
    });
    afterAll(async () => {
        if (sql)
            await sql.end();
        if (netlifyDB)
            await netlifyDB.stop();
    });
    async function cleanup() {
        await db.delete(memberships);
        await db.delete(organizations);
        await db.delete(platformUsers);
    }
    beforeEach(async () => {
        await cleanup();
    });
    runMembershipRepositoryContractTests("DrizzleMembershipRepository", {
        async createRepository() {
            return repo;
        },
        async createOrganization(id) {
            await orgRepo.create(createOrganizationDraft({
                id: id,
                name: `Org ${id}`,
                slug: `slug-${id}`,
                billingEmail: `billing-${id}@example.com`,
                planId: null,
                now: "2026-08-19T00:00:00Z",
            }));
        },
        async createUser(id, email) {
            await userRepo.create(createUserDraft({
                id: id,
                authSubjectId: `auth-${id}`,
                email,
                displayName: `User ${id}`,
                now: "2026-08-19T00:00:00Z",
            }));
        },
        async cleanup() {
            await cleanup();
        },
    });
    it("0008 migration applies successfully and table exists", async () => {
        const rows = await db.select().from(memberships);
        expect(Array.isArray(rows)).toBe(true);
    });
    it("enforces foreign key constraints on organization_id and user_id", async () => {
        const draft = createMembershipDraft({
            id: "mem-invalid-fk",
            organizationId: "nonexistent-org",
            userId: "nonexistent-user",
            role: "admin",
            now: "2026-08-19T00:00:00Z",
        });
        const res = await repo.create(draft);
        expect(res.ok).toBe(false);
        if (!res.ok) {
            expect(res.error.code).toBe("invalid_persistence_state");
        }
    });
    describe("Sole-Owner Concurrency Under Heavy Race Condition", () => {
        it("simultaneous concurrent owner removal requests cannot leave zero owners", async () => {
            const orgId = "org-race-1";
            const user1 = "user-race-1";
            const user2 = "user-race-2";
            await orgRepo.create(createOrganizationDraft({
                id: orgId,
                name: "Race Org",
                slug: "race-org",
                billingEmail: "race@example.com",
                planId: null,
                now: "2026-08-19T00:00:00Z",
            }));
            await userRepo.create(createUserDraft({
                id: user1,
                authSubjectId: "auth-race-1",
                email: "race1@example.com",
                displayName: "Race 1",
                now: "2026-08-19T00:00:00Z",
            }));
            await userRepo.create(createUserDraft({
                id: user2,
                authSubjectId: "auth-race-2",
                email: "race2@example.com",
                displayName: "Race 2",
                now: "2026-08-19T00:00:00Z",
            }));
            const mem1 = await repo.create(createMembershipDraft({
                id: "mem-race-1",
                organizationId: orgId,
                userId: user1,
                role: "owner",
                now: "2026-08-19T00:00:00Z",
            }));
            const mem2 = await repo.create(createMembershipDraft({
                id: "mem-race-2",
                organizationId: orgId,
                userId: user2,
                role: "owner",
                now: "2026-08-19T00:00:00Z",
            }));
            expect(mem1.ok).toBe(true);
            expect(mem2.ok).toBe(true);
            // Concurrently execute 2 remove operations targeting both owners
            const [res1, res2] = await Promise.all([
                repo.archive("mem-race-1", 1),
                repo.archive("mem-race-2", 1),
            ]);
            // Exactly ONE must succeed and ONE must fail
            const successCount = (res1.ok ? 1 : 0) + (res2.ok ? 1 : 0);
            const failureCount = (!res1.ok ? 1 : 0) + (!res2.ok ? 1 : 0);
            expect(successCount).toBe(1);
            expect(failureCount).toBe(1);
            // Verify that at least 1 active owner remains in the organization
            const activeOwners = await repo.listActiveOwners(orgId);
            expect(activeOwners.length).toBe(1);
        });
        it("simultaneous concurrent owner demotion requests cannot leave zero owners", async () => {
            const orgId = "org-race-demote";
            const user1 = "user-demote-1";
            const user2 = "user-demote-2";
            await orgRepo.create(createOrganizationDraft({
                id: orgId,
                name: "Demote Org",
                slug: "demote-org",
                billingEmail: "demote@example.com",
                planId: null,
                now: "2026-08-19T00:00:00Z",
            }));
            await userRepo.create(createUserDraft({
                id: user1,
                authSubjectId: "auth-demote-1",
                email: "demote1@example.com",
                displayName: "Demote 1",
                now: "2026-08-19T00:00:00Z",
            }));
            await userRepo.create(createUserDraft({
                id: user2,
                authSubjectId: "auth-demote-2",
                email: "demote2@example.com",
                displayName: "Demote 2",
                now: "2026-08-19T00:00:00Z",
            }));
            await repo.create(createMembershipDraft({
                id: "mem-demote-1",
                organizationId: orgId,
                userId: user1,
                role: "owner",
                now: "2026-08-19T00:00:00Z",
            }));
            await repo.create(createMembershipDraft({
                id: "mem-demote-2",
                organizationId: orgId,
                userId: user2,
                role: "owner",
                now: "2026-08-19T00:00:00Z",
            }));
            // Concurrently execute demotions
            const [res1, res2] = await Promise.all([
                repo.changeRole("mem-demote-1", "editor", 1),
                repo.changeRole("mem-demote-2", "editor", 1),
            ]);
            const successCount = (res1.ok ? 1 : 0) + (res2.ok ? 1 : 0);
            const failureCount = (!res1.ok ? 1 : 0) + (!res2.ok ? 1 : 0);
            expect(successCount).toBe(1);
            expect(failureCount).toBe(1);
            const activeOwners = await repo.listActiveOwners(orgId);
            expect(activeOwners.length).toBe(1);
        });
    });
});
//# sourceMappingURL=drizzle-membership.integration.test.js.map