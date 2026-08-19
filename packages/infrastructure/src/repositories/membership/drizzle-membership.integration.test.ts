import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { NetlifyDB } from "@netlify/database-dev";
import { NoopLogger } from "@livingsites/platform";
import { runMembershipRepositoryContractTests } from "@livingsites/test-support";
import {
  createMembershipDraft,
  createOrganizationDraft,
  createUserDraft,
  type AuthSubjectId,
  type ISODateString,
  type MembershipId,
  type OrganizationId,
  type OrganizationMemberAddedEvent,
  type OrganizationMemberRemovedEvent,
  type OrganizationMemberRoleChangedEvent,
  type Slug,
  type UserId,
  type WebsiteId,
} from "@livingsites/domain";
import { applicationOutbox, memberships, organizations, platformUsers } from "../../db/schema";
import * as schema from "../../db/schema";
import type { DrizzleDB } from "../../db/drizzle-instance";
import { DrizzleOrganizationRepository } from "../organization/drizzle-organization-repository";
import { DrizzleUserRepository } from "../user/drizzle-user-repository";
import { DrizzleMembershipRepository } from "./drizzle-membership-repository";

const now = "2026-08-19T00:00:00Z" as ISODateString;

describe("DrizzleMembershipRepository — database integration", () => {
  let netlifyDB: NetlifyDB;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let repo: DrizzleMembershipRepository;
  let secondRepo: DrizzleMembershipRepository;
  let userRepo: DrizzleUserRepository;
  let orgRepo: DrizzleOrganizationRepository;

  beforeAll(async () => {
    netlifyDB = new NetlifyDB({ logger: () => {} });
    await netlifyDB.start();
    await netlifyDB.applyMigrations("./netlify/database/migrations");
    const embeddedDatabase = (netlifyDB as unknown as { db: Parameters<typeof drizzle>[0] }).db;
    db = drizzle(embeddedDatabase, { schema });
    const logger = new NoopLogger();
    const repositoryDb = db as unknown as DrizzleDB;
    repo = new DrizzleMembershipRepository({ db: repositoryDb, logger });
    secondRepo = new DrizzleMembershipRepository({ db: repositoryDb, logger });
    userRepo = new DrizzleUserRepository({ db: repositoryDb, logger });
    orgRepo = new DrizzleOrganizationRepository({ db: repositoryDb, logger });
  });

  afterAll(async () => {
    if (netlifyDB) await netlifyDB.stop();
  });

  async function cleanup() {
    await db.delete(applicationOutbox);
    await db.delete(memberships);
    await db.delete(organizations);
    await db.delete(platformUsers);
  }

  async function createOrganization(id: string) {
    await orgRepo.create(createOrganizationDraft({
      id: id as OrganizationId,
      name: `Org ${id}`,
      slug: `slug-${id}` as Slug,
      billingEmail: `billing-${id}@example.com`,
      planId: null,
      now,
    }));
  }

  async function createUser(id: string, email = `${id}@example.com`) {
    await userRepo.create(createUserDraft({
      id: id as UserId,
      authSubjectId: `auth-${id}` as AuthSubjectId,
      email,
      displayName: `User ${id}`,
      now,
    }));
  }

  async function createMember(
    id: string,
    organizationId: string,
    userId: string,
    role: "owner" | "admin" | "editor" | "viewer",
    websiteScopeId?: string,
  ) {
    return repo.create(createMembershipDraft({
      id: id as MembershipId,
      organizationId: organizationId as OrganizationId,
      userId: userId as UserId,
      role,
      websiteScopeId: websiteScopeId as WebsiteId | undefined,
      now,
    }));
  }

  beforeEach(cleanup);

  runMembershipRepositoryContractTests("DrizzleMembershipRepository", {
    createRepository: async () => repo,
    createOrganization,
    createUser,
    cleanup,
  });

  it("0010 migration applies and membership table exists", async () => {
    expect(Array.isArray(await db.select().from(memberships))).toBe(true);
  });

  it("enforces foreign keys and rejects platform_super_admin membership roles", async () => {
    const invalidForeignKey = await repo.create(createMembershipDraft({
      id: "mem-invalid-fk" as MembershipId,
      organizationId: "nonexistent-org" as OrganizationId,
      userId: "nonexistent-user" as UserId,
      role: "admin",
      now,
    }));
    expect(invalidForeignKey.ok).toBe(false);

    await createOrganization("org-role-boundary");
    await createUser("user-role-boundary");
    const invalidRole = await repo.create(createMembershipDraft({
      id: "mem-invalid-role" as MembershipId,
      organizationId: "org-role-boundary" as OrganizationId,
      userId: "user-role-boundary" as UserId,
      role: "platform_super_admin",
      now,
    }));
    expect(invalidRole.ok).toBe(false);
  });

  it("does not expose generic save as a sole-owner bypass", () => {
    expect((repo as unknown as { save?: unknown }).save).toBeUndefined();
  });

  describe("sole-owner locking", () => {
    it("two repository instances cannot concurrently remove all owners", async () => {
      await createOrganization("org-race-remove");
      await createUser("user-race-remove-1");
      await createUser("user-race-remove-2");
      await createMember("mem-race-remove-1", "org-race-remove", "user-race-remove-1", "owner");
      await createMember("mem-race-remove-2", "org-race-remove", "user-race-remove-2", "owner");

      const [first, second] = await Promise.all([
        repo.archive("mem-race-remove-1" as MembershipId, 1),
        secondRepo.archive("mem-race-remove-2" as MembershipId, 1),
      ]);

      expect(Number(first.ok) + Number(second.ok)).toBe(1);
      expect((await repo.listActiveOwners("org-race-remove" as OrganizationId))).toHaveLength(1);
    });

    it("two repository instances cannot concurrently demote all owners", async () => {
      await createOrganization("org-race-demote");
      await createUser("user-race-demote-1");
      await createUser("user-race-demote-2");
      await createMember("mem-race-demote-1", "org-race-demote", "user-race-demote-1", "owner");
      await createMember("mem-race-demote-2", "org-race-demote", "user-race-demote-2", "owner");

      const [first, second] = await Promise.all([
        repo.changeRole("mem-race-demote-1" as MembershipId, "editor", 1),
        secondRepo.changeRole("mem-race-demote-2" as MembershipId, "editor", 1),
      ]);

      expect(Number(first.ok) + Number(second.ok)).toBe(1);
      expect((await repo.listActiveOwners("org-race-demote" as OrganizationId))).toHaveLength(1);
    });
  });

  it("resolves website memberships deterministically", async () => {
    await createOrganization("org-scopes");
    await createUser("user-scopes");
    await createMember("mem-site-a", "org-scopes", "user-scopes", "viewer", "site-a");
    await createMember("mem-site-b", "org-scopes", "user-scopes", "editor", "site-b");

    const siteA = await repo.findForUserAndOrganization(
      "org-scopes" as OrganizationId,
      "user-scopes" as UserId,
      "site-a" as WebsiteId,
    );
    const siteB = await repo.findForUserAndOrganization(
      "org-scopes" as OrganizationId,
      "user-scopes" as UserId,
      "site-b" as WebsiteId,
    );
    const wrongSite = await repo.findForUserAndOrganization(
      "org-scopes" as OrganizationId,
      "user-scopes" as UserId,
      "site-c" as WebsiteId,
    );

    expect(siteA?.id).toBe("mem-site-a");
    expect(siteB?.id).toBe("mem-site-b");
    expect(wrongSite).toBeNull();

    await createMember("mem-org-wide", "org-scopes", "user-scopes", "admin");
    const overlap = await repo.findForUserAndOrganization(
      "org-scopes" as OrganizationId,
      "user-scopes" as UserId,
      "site-b" as WebsiteId,
    );
    expect(overlap?.id).toBe("mem-org-wide");
  });

  it("atomically persists add, role-change, and removal outbox events", async () => {
    const organizationId = "org-atomic" as OrganizationId;
    const userId = "user-atomic" as UserId;
    const membershipId = "mem-atomic" as MembershipId;
    await createOrganization(organizationId);
    await createUser(userId);

    const addedEvent: OrganizationMemberAddedEvent = {
      type: "organization.member_added",
      occurredAt: now,
      eventScope: { scope: "organization", organizationId },
      membershipId,
      userId,
      role: "viewer",
      websiteScopeId: null,
    };
    const created = await repo.createWithEvent(createMembershipDraft({
      id: membershipId,
      organizationId,
      userId,
      role: "viewer",
      now,
    }), addedEvent);
    expect(created.ok).toBe(true);

    const changedEvent: OrganizationMemberRoleChangedEvent = {
      type: "organization.member_role_changed",
      occurredAt: now,
      eventScope: { scope: "organization", organizationId },
      membershipId,
      userId,
      previousRole: "viewer",
      newRole: "editor",
    };
    const changed = await repo.changeRoleWithEvent(membershipId, "editor", 1, changedEvent);
    expect(changed.ok).toBe(true);

    const removedEvent: OrganizationMemberRemovedEvent = {
      type: "organization.member_removed",
      occurredAt: now,
      eventScope: { scope: "organization", organizationId },
      membershipId,
      userId,
    };
    const removed = await repo.archiveWithEvent(membershipId, 2, removedEvent);
    expect(removed.ok).toBe(true);

    const outboxRows = await db.select().from(applicationOutbox);
    expect(outboxRows.map((row) => row.event_type).sort()).toEqual([
      "organization.member_added",
      "organization.member_removed",
      "organization.member_role_changed",
    ]);
    const persisted = await repo.findById(membershipId);
    expect(persisted?.status).toBe("archived");
    expect(persisted?.version).toBe(3);
  });

  it("rolls back membership mutation when outbox insertion fails", async () => {
    const organizationId = "org-rollback" as OrganizationId;
    const userId = "user-rollback" as UserId;
    const membershipId = "mem-rollback" as MembershipId;
    await createOrganization(organizationId);
    await createUser(userId);

    await db.execute(sql.raw(`
      CREATE OR REPLACE FUNCTION reject_membership_outbox() RETURNS trigger AS $$
      BEGIN
        IF NEW.event_type = 'organization.member_added' THEN
          RAISE EXCEPTION 'forced membership outbox failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `));
    await db.execute(sql.raw(`
      CREATE TRIGGER reject_membership_outbox_trigger
      BEFORE INSERT ON application_outbox
      FOR EACH ROW EXECUTE FUNCTION reject_membership_outbox()
    `));

    try {
      const event: OrganizationMemberAddedEvent = {
        type: "organization.member_added",
        occurredAt: now,
        eventScope: { scope: "organization", organizationId },
        membershipId,
        userId,
        role: "viewer",
        websiteScopeId: null,
      };
      const result = await repo.createWithEvent(createMembershipDraft({
        id: membershipId,
        organizationId,
        userId,
        role: "viewer",
        now,
      }), event);

      expect(result.ok).toBe(false);
      expect(await repo.findById(membershipId)).toBeNull();
      expect(await db.select().from(applicationOutbox)).toHaveLength(0);
    } finally {
      await db.execute(sql.raw("DROP TRIGGER IF EXISTS reject_membership_outbox_trigger ON application_outbox"));
      await db.execute(sql.raw("DROP FUNCTION IF EXISTS reject_membership_outbox()"));
    }
  });
});
