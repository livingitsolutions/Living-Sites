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
import {
  createMembershipDraft,
  createOrganizationDraft,
  createUserDraft,
  type MembershipId,
  type OrganizationId,
  type UserId,
  type AuthSubjectId,
  type Slug,
  type ISODateString,
} from "@livingsites/domain";

describe("DrizzleMembershipRepository — database integration", () => {
  let netlifyDB: NetlifyDB;
  let connectionString: string;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let sql: ReturnType<typeof postgres>;
  let repo: DrizzleMembershipRepository;
  let userRepo: DrizzleUserRepository;
  let orgRepo: DrizzleOrganizationRepository;

  beforeAll(async () => {
    netlifyDB = new NetlifyDB({ logger: () => {} });
    connectionString = await netlifyDB.start();
    await netlifyDB.applyMigrations("./netlify/database/migrations");
    sql = postgres(connectionString, { prepare: false, max: 10 });
    db = drizzle({ client: sql, schema });
    const logger = new NoopLogger();
    repo = new DrizzleMembershipRepository({ db, logger });
    userRepo = new DrizzleUserRepository({ db, logger });
    orgRepo = new DrizzleOrganizationRepository({ db, logger });
  });

  afterAll(async () => {
    if (sql) await sql.end();
    if (netlifyDB) await netlifyDB.stop();
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
    async createOrganization(id: string) {
      await orgRepo.create(
        createOrganizationDraft({
          id: id as OrganizationId,
          name: `Org ${id}`,
          slug: `slug-${id}` as Slug,
          billingEmail: `billing-${id}@example.com`,
          planId: null,
          now: "2026-08-19T00:00:00Z" as ISODateString,
        }),
      );
    },
    async createUser(id: string, email: string) {
      await userRepo.create(
        createUserDraft({
          id: id as UserId,
          authSubjectId: `auth-${id}` as AuthSubjectId,
          email,
          displayName: `User ${id}`,
          now: "2026-08-19T00:00:00Z" as ISODateString,
        }),
      );
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
      id: "mem-invalid-fk" as MembershipId,
      organizationId: "nonexistent-org" as OrganizationId,
      userId: "nonexistent-user" as UserId,
      role: "admin",
      now: "2026-08-19T00:00:00Z" as ISODateString,
    });

    const res = await repo.create(draft);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("invalid_persistence_state");
    }
  });

  describe("Sole-Owner Concurrency Under Heavy Race Condition", () => {
    it("simultaneous concurrent owner removal requests cannot leave zero owners", async () => {
      const orgId = "org-race-1" as OrganizationId;
      const user1 = "user-race-1" as UserId;
      const user2 = "user-race-2" as UserId;

      await orgRepo.create(
        createOrganizationDraft({
          id: orgId,
          name: "Race Org",
          slug: "race-org" as Slug,
          billingEmail: "race@example.com",
          planId: null,
          now: "2026-08-19T00:00:00Z" as ISODateString,
        }),
      );

      await userRepo.create(
        createUserDraft({
          id: user1,
          authSubjectId: "auth-race-1" as AuthSubjectId,
          email: "race1@example.com",
          displayName: "Race 1",
          now: "2026-08-19T00:00:00Z" as ISODateString,
        }),
      );

      await userRepo.create(
        createUserDraft({
          id: user2,
          authSubjectId: "auth-race-2" as AuthSubjectId,
          email: "race2@example.com",
          displayName: "Race 2",
          now: "2026-08-19T00:00:00Z" as ISODateString,
        }),
      );

      const mem1 = await repo.create(
        createMembershipDraft({
          id: "mem-race-1" as MembershipId,
          organizationId: orgId,
          userId: user1,
          role: "owner",
          now: "2026-08-19T00:00:00Z" as ISODateString,
        }),
      );

      const mem2 = await repo.create(
        createMembershipDraft({
          id: "mem-race-2" as MembershipId,
          organizationId: orgId,
          userId: user2,
          role: "owner",
          now: "2026-08-19T00:00:00Z" as ISODateString,
        }),
      );

      expect(mem1.ok).toBe(true);
      expect(mem2.ok).toBe(true);

      // Concurrently execute 2 remove operations targeting both owners
      const [res1, res2] = await Promise.all([
        repo.archive("mem-race-1" as MembershipId, 1),
        repo.archive("mem-race-2" as MembershipId, 1),
      ]);

      const successCount = (res1.ok ? 1 : 0) + (res2.ok ? 1 : 0);
      const failureCount = (!res1.ok ? 1 : 0) + (!res2.ok ? 1 : 0);

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // Verify that at least 1 active owner remains in the organization
      const activeOwners = await repo.listActiveOwners(orgId);
      expect(activeOwners.length).toBe(1);
    });

    it("simultaneous concurrent owner demotion requests cannot leave zero owners", async () => {
      const orgId = "org-race-demote" as OrganizationId;
      const user1 = "user-demote-1" as UserId;
      const user2 = "user-demote-2" as UserId;

      await orgRepo.create(
        createOrganizationDraft({
          id: orgId,
          name: "Demote Org",
          slug: "demote-org" as Slug,
          billingEmail: "demote@example.com",
          planId: null,
          now: "2026-08-19T00:00:00Z" as ISODateString,
        }),
      );

      await userRepo.create(
        createUserDraft({
          id: user1,
          authSubjectId: "auth-demote-1" as AuthSubjectId,
          email: "demote1@example.com",
          displayName: "Demote 1",
          now: "2026-08-19T00:00:00Z" as ISODateString,
        }),
      );

      await userRepo.create(
        createUserDraft({
          id: user2,
          authSubjectId: "auth-demote-2" as AuthSubjectId,
          email: "demote2@example.com",
          displayName: "Demote 2",
          now: "2026-08-19T00:00:00Z" as ISODateString,
        }),
      );

      const m1 = await repo.create(
        createMembershipDraft({
          id: "mem-demote-1" as MembershipId,
          organizationId: orgId,
          userId: user1,
          role: "owner",
          now: "2026-08-19T00:00:00Z" as ISODateString,
        }),
      );

      const m2 = await repo.create(
        createMembershipDraft({
          id: "mem-demote-2" as MembershipId,
          organizationId: orgId,
          userId: user2,
          role: "owner",
          now: "2026-08-19T00:00:00Z" as ISODateString,
        }),
      );

      expect(m1.ok).toBe(true);
      expect(m2.ok).toBe(true);

      // Concurrently execute demotions
      const [res1, res2] = await Promise.all([
        repo.changeRole("mem-demote-1" as MembershipId, "editor", 1),
        repo.changeRole("mem-demote-2" as MembershipId, "editor", 1),
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
