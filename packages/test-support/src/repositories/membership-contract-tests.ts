import { describe, it, expect, beforeEach } from "vitest";
import type {
  MembershipRepository,
} from "@livingsites/application";
import type {
  MembershipDraft,
  OrganizationId,
  UserId,
  MembershipId,
  ISODateString,
} from "@livingsites/domain";
import { createMembershipDraft } from "@livingsites/domain";

export interface MembershipRepositoryContractFixtures {
  createRepository(): Promise<MembershipRepository>;
  createOrganization(id: string): Promise<void>;
  createUser(id: string, email: string): Promise<void>;
  cleanup(): Promise<void>;
}

export function runMembershipRepositoryContractTests(
  name: string,
  fixtures: MembershipRepositoryContractFixtures,
): void {
  describe(`MembershipRepository contract: ${name}`, () => {
    let repo: MembershipRepository;

    beforeEach(async () => {
      await fixtures.cleanup();
      repo = await fixtures.createRepository();
    });

    it("creates and retrieves a membership", async () => {
      await fixtures.createOrganization("org-1");
      await fixtures.createUser("user-1", "user1@example.com");

      const draft: MembershipDraft = createMembershipDraft({
        id: "mem-1" as MembershipId,
        organizationId: "org-1" as OrganizationId,
        userId: "user-1" as UserId,
        role: "admin",
        now: "2026-08-19T10:00:00.000Z" as ISODateString,
      });

      const createRes = await repo.create(draft);
      expect(createRes.ok).toBe(true);
      if (!createRes.ok) return;

      expect(createRes.value.id).toBe("mem-1");
      expect(createRes.value.version).toBe(1);
      expect(createRes.value.role).toBe("admin");

      const fetched = await repo.findById("mem-1" as MembershipId);
      expect(fetched).not.toBeNull();
      expect(fetched?.role).toBe("admin");
      expect(fetched?.organizationId).toBe("org-1");
      expect(fetched?.userId).toBe("user-1");

      const byOrgAndUser = await repo.findForUserAndOrganization("org-1" as OrganizationId, "user-1" as UserId);
      expect(byOrgAndUser).not.toBeNull();
      expect(byOrgAndUser?.id).toBe("mem-1");
    });

    it("fails with duplicate_key when creating duplicate active org-wide membership", async () => {
      await fixtures.createOrganization("org-1");
      await fixtures.createUser("user-1", "user1@example.com");

      const draft1 = createMembershipDraft({
        id: "mem-1" as MembershipId,
        organizationId: "org-1" as OrganizationId,
        userId: "user-1" as UserId,
        role: "admin",
        now: "2026-08-19T10:00:00.000Z" as ISODateString,
      });

      const res1 = await repo.create(draft1);
      expect(res1.ok).toBe(true);

      const draft2 = createMembershipDraft({
        id: "mem-2" as MembershipId,
        organizationId: "org-1" as OrganizationId,
        userId: "user-1" as UserId,
        role: "editor",
        now: "2026-08-19T10:00:00.000Z" as ISODateString,
      });

      const res2 = await repo.create(draft2);
      expect(res2.ok).toBe(false);
      if (!res2.ok) {
        expect(res2.error.code).toBe("duplicate_key");
      }
    });

    it("changes role with optimistic concurrency", async () => {
      await fixtures.createOrganization("org-1");
      await fixtures.createUser("user-1", "user1@example.com");

      const draft = createMembershipDraft({
        id: "mem-1" as MembershipId,
        organizationId: "org-1" as OrganizationId,
        userId: "user-1" as UserId,
        role: "editor",
        now: "2026-08-19T10:00:00.000Z" as ISODateString,
      });
      await repo.create(draft);

      // Mutate with correct version (1)
      const updateRes = await repo.changeRole("mem-1" as MembershipId, "admin", 1);
      expect(updateRes.ok).toBe(true);
      if (!updateRes.ok) return;

      expect(updateRes.value.role).toBe("admin");
      expect(updateRes.value.version).toBe(2);

      // Stale version mutation fails with concurrency conflict
      const staleRes = await repo.changeRole("mem-1" as MembershipId, "editor", 1);
      expect(staleRes.ok).toBe(false);
      if (!staleRes.ok) {
        expect("expectedVersion" in staleRes.error).toBe(true);
      }
    });

    it("archives a membership with optimistic concurrency", async () => {
      await fixtures.createOrganization("org-1");
      await fixtures.createUser("user-1", "user1@example.com");

      const draft = createMembershipDraft({
        id: "mem-1" as MembershipId,
        organizationId: "org-1" as OrganizationId,
        userId: "user-1" as UserId,
        role: "editor",
        now: "2026-08-19T10:00:00.000Z" as ISODateString,
      });
      await repo.create(draft);

      const archiveRes = await repo.archive("mem-1" as MembershipId, 1);
      expect(archiveRes.ok).toBe(true);

      const active = await repo.findForUserAndOrganization("org-1" as OrganizationId, "user-1" as UserId);
      expect(active).toBeNull();
    });

    it("prevents demoting or removing the sole remaining owner", async () => {
      await fixtures.createOrganization("org-1");
      await fixtures.createUser("user-owner-1", "owner1@example.com");

      const draft = createMembershipDraft({
        id: "mem-owner-1" as MembershipId,
        organizationId: "org-1" as OrganizationId,
        userId: "user-owner-1" as UserId,
        role: "owner",
        now: "2026-08-19T10:00:00.000Z" as ISODateString,
      });
      await repo.create(draft);

      // Attempt to demote sole owner
      const demoteRes = await repo.changeRole("mem-owner-1" as MembershipId, "editor", 1);
      expect(demoteRes.ok).toBe(false);

      // Attempt to archive sole owner
      const removeRes = await repo.archive("mem-owner-1" as MembershipId, 1);
      expect(removeRes.ok).toBe(false);
    });

    it("allows demoting an owner if another active owner exists", async () => {
      await fixtures.createOrganization("org-1");
      await fixtures.createUser("user-owner-1", "owner1@example.com");
      await fixtures.createUser("user-owner-2", "owner2@example.com");

      const draft1 = createMembershipDraft({
        id: "mem-owner-1" as MembershipId,
        organizationId: "org-1" as OrganizationId,
        userId: "user-owner-1" as UserId,
        role: "owner",
        now: "2026-08-19T10:00:00.000Z" as ISODateString,
      });
      await repo.create(draft1);

      const draft2 = createMembershipDraft({
        id: "mem-owner-2" as MembershipId,
        organizationId: "org-1" as OrganizationId,
        userId: "user-owner-2" as UserId,
        role: "owner",
        now: "2026-08-19T10:00:00.000Z" as ISODateString,
      });
      await repo.create(draft2);

      // Demoting owner 1 succeeds because owner 2 is also active
      const demoteRes = await repo.changeRole("mem-owner-1" as MembershipId, "editor", 1);
      expect(demoteRes.ok).toBe(true);

      // But now demoting owner 2 fails
      const demoteRes2 = await repo.changeRole("mem-owner-2" as MembershipId, "editor", 1);
      expect(demoteRes2.ok).toBe(false);
    });
  });
}
