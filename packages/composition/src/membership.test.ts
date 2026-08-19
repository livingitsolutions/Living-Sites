import { describe, it, expect, beforeEach } from "vitest";
import {
  addOrganizationMember,
  changeOrganizationMemberRole,
  removeOrganizationMember,
  getOrganizationMembers,
  AuthorizationService,
} from "@livingsites/application";
import {
  InMemoryMembershipRepository,
  InMemoryUserRepository,
  FakeClock,
  DeterministicIdGenerator,
} from "@livingsites/test-support";
import type { OrganizationId, UserId, MembershipId } from "@livingsites/domain";

describe("Membership Use Cases", () => {
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let clock: FakeClock;
  let idGenerator: DeterministicIdGenerator;
  let authService: AuthorizationService;

  const orgA = "org-A" as OrganizationId;
  const orgB = "org-B" as OrganizationId;
  const ownerA = "user-owner-A" as UserId;
  const adminA = "user-admin-A" as UserId;
  const editorA = "user-editor-A" as UserId;
  const viewerA = "user-viewer-A" as UserId;
  const callerB = "user-owner-B" as UserId;

  beforeEach(async () => {
    membershipRepo = new InMemoryMembershipRepository();
    userRepo = new InMemoryUserRepository();
    clock = new FakeClock(1000);
    idGenerator = new DeterministicIdGenerator();
    authService = new AuthorizationService({ membershipReader: membershipRepo });

    // Seed users in userRepo
    await userRepo.create({
      id: ownerA,
      authSubjectId: "auth-owner-a" as any,
      email: "owner-a@example.com",
      displayName: "Owner A",
      status: "active",
      version: 0 as any,
      audit: { createdAt: "2026-08-19T00:00:00Z" as any, updatedAt: "2026-08-19T00:00:00Z" as any },
    });
    await userRepo.create({
      id: adminA,
      authSubjectId: "auth-admin-a" as any,
      email: "admin-a@example.com",
      displayName: "Admin A",
      status: "active",
      version: 0 as any,
      audit: { createdAt: "2026-08-19T00:00:00Z" as any, updatedAt: "2026-08-19T00:00:00Z" as any },
    });
    await userRepo.create({
      id: editorA,
      authSubjectId: "auth-editor-a" as any,
      email: "editor-a@example.com",
      displayName: "Editor A",
      status: "active",
      version: 0 as any,
      audit: { createdAt: "2026-08-19T00:00:00Z" as any, updatedAt: "2026-08-19T00:00:00Z" as any },
    });

    // Seed initial memberships in org A
    await membershipRepo.create({
      id: "mem-owner-a" as MembershipId,
      organizationId: orgA,
      userId: ownerA,
      role: "owner",
      status: "active",
    });

    await membershipRepo.create({
      id: "mem-admin-a" as MembershipId,
      organizationId: orgA,
      userId: adminA,
      role: "admin",
      status: "active",
    });

    // Seed org B membership
    await membershipRepo.create({
      id: "mem-owner-b" as MembershipId,
      organizationId: orgB,
      userId: callerB,
      role: "owner",
      status: "active",
    });
  });

  describe("AddOrganizationMember", () => {
    it("allows Owner to add a new member and emits OrganizationMemberAdded event", async () => {
      const res = await addOrganizationMember(
        {
          organizationId: orgA,
          userId: editorA,
          role: "editor",
          callerUserId: ownerA,
        },
        {
          membershipRepository: membershipRepo,
          userReader: userRepo,
          authorizationService: authService,
          clock,
          idGenerator,
        },
      );

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.membership.role).toBe("editor");
      expect(res.value.membership.organizationId).toBe(orgA);
      expect(res.value.membership.userId).toBe(editorA);
      expect(res.value.membership.version).toBe(1);

      // Verify event emission
      expect(membershipRepo.publishedEvents).toHaveLength(1);
      expect(membershipRepo.publishedEvents[0]?.type).toBe("organization.member_added");
    });

    it("rejects caller lacking invite permission", async () => {
      // Create a viewer in org A
      await membershipRepo.create({
        id: "mem-viewer-a" as MembershipId,
        organizationId: orgA,
        userId: viewerA,
        role: "viewer",
        status: "active",
      });

      const res = await addOrganizationMember(
        {
          organizationId: orgA,
          userId: editorA,
          role: "editor",
          callerUserId: viewerA,
        },
        {
          membershipRepository: membershipRepo,
          userReader: userRepo,
          authorizationService: authService,
          clock,
          idGenerator,
        },
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect("code" in res.error && res.error.code).toBe("unauthorized");
      }
    });

    it("rejects caller from another organization (tenant isolation)", async () => {
      const res = await addOrganizationMember(
        {
          organizationId: orgA,
          userId: editorA,
          role: "editor",
          callerUserId: callerB, // user from org B
        },
        {
          membershipRepository: membershipRepo,
          userReader: userRepo,
          authorizationService: authService,
          clock,
          idGenerator,
        },
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect("code" in res.error && res.error.code).toBe("unauthorized");
      }
    });

    it("rejects duplicate active membership", async () => {
      const res = await addOrganizationMember(
        {
          organizationId: orgA,
          userId: adminA, // already member
          role: "viewer",
          callerUserId: ownerA,
        },
        {
          membershipRepository: membershipRepo,
          userReader: userRepo,
          authorizationService: authService,
          clock,
          idGenerator,
        },
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect("code" in res.error && res.error.code).toBe("duplicate_membership");
      }
    });

    it("does not trust a spoofed super-admin flag in use-case input", async () => {
      const spoofedInput = {
        organizationId: orgA,
        userId: editorA,
        role: "editor",
        callerUserId: callerB,
        isPlatformSuperAdmin: true,
      };

      const res = await addOrganizationMember(spoofedInput, {
        membershipRepository: membershipRepo,
        userReader: userRepo,
        authorizationService: authService,
        clock,
        idGenerator,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("unauthorized");
    });

    it("rejects platform_super_admin as an organization membership role", async () => {
      const res = await addOrganizationMember({
        organizationId: orgA,
        userId: editorA,
        role: "platform_super_admin",
        callerUserId: ownerA,
      }, {
        membershipRepository: membershipRepo,
        userReader: userRepo,
        authorizationService: authService,
        clock,
        idGenerator,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("validation_error");
    });
  });

  describe("ChangeOrganizationMemberRole", () => {
    it("allows Owner to change member role and emits OrganizationMemberRoleChanged event", async () => {
      const res = await changeOrganizationMemberRole(
        {
          membershipId: "mem-admin-a" as MembershipId,
          newRole: "editor",
          expectedVersion: 1,
          callerUserId: ownerA,
        },
        {
          membershipRepository: membershipRepo,
          authorizationService: authService,
          clock,
        },
      );

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.membership.role).toBe("editor");
      expect(res.value.membership.version).toBe(2);

      expect(membershipRepo.publishedEvents).toHaveLength(1);
      expect(membershipRepo.publishedEvents[0]?.type).toBe("organization.member_role_changed");
    });

    it("prevents demoting the sole remaining owner", async () => {
      const res = await changeOrganizationMemberRole(
        {
          membershipId: "mem-owner-a" as MembershipId,
          newRole: "admin",
          expectedVersion: 1,
          callerUserId: ownerA,
        },
        {
          membershipRepository: membershipRepo,
          authorizationService: authService,
          clock,
        },
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect("code" in res.error && res.error.code).toBe("cannot_demote_sole_owner");
      }
    });

    it("rejects mutation on version mismatch (optimistic concurrency)", async () => {
      const res = await changeOrganizationMemberRole(
        {
          membershipId: "mem-admin-a" as MembershipId,
          newRole: "editor",
          expectedVersion: 99, // wrong version
          callerUserId: ownerA,
        },
        {
          membershipRepository: membershipRepo,
          authorizationService: authService,
          clock,
        },
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect("expectedVersion" in res.error).toBe(true);
      }
    });
  });

  describe("RemoveOrganizationMember", () => {
    it("allows Owner to remove a member and emits OrganizationMemberRemoved event", async () => {
      const res = await removeOrganizationMember(
        {
          membershipId: "mem-admin-a" as MembershipId,
          expectedVersion: 1,
          callerUserId: ownerA,
        },
        {
          membershipRepository: membershipRepo,
          authorizationService: authService,
          clock,
        },
      );

      expect(res.ok).toBe(true);
      expect(membershipRepo.publishedEvents).toHaveLength(1);
      expect(membershipRepo.publishedEvents[0]?.type).toBe("organization.member_removed");

      const active = await membershipRepo.findForUserAndOrganization(orgA, adminA);
      expect(active).toBeNull();
    });

    it("prevents removing the sole remaining owner", async () => {
      const res = await removeOrganizationMember(
        {
          membershipId: "mem-owner-a" as MembershipId,
          expectedVersion: 1,
          callerUserId: ownerA,
        },
        {
          membershipRepository: membershipRepo,
          authorizationService: authService,
          clock,
        },
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect("code" in res.error && res.error.code).toBe("cannot_remove_sole_owner");
      }
    });
  });

  describe("GetOrganizationMembers", () => {
    it("allows member with MembersRead permission to list org members", async () => {
      const res = await getOrganizationMembers(
        {
          organizationId: orgA,
          callerUserId: ownerA,
        },
        {
          membershipRepository: membershipRepo,
          authorizationService: authService,
        },
      );

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.members.length).toBeGreaterThanOrEqual(2);
    });

    it("rejects caller from outside the organization (tenant isolation)", async () => {
      const res = await getOrganizationMembers(
        {
          organizationId: orgA,
          callerUserId: callerB,
        },
        {
          membershipRepository: membershipRepo,
          authorizationService: authService,
        },
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("unauthorized");
      }
    });
  });
});
