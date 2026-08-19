import { describe, it, expect, beforeEach } from "vitest";
import {
  AuthorizationService,
  OrganizationPermissions,
  WebsitePermissions,
  PagePermissions,
  MediaPermissions,
  FormPermissions,
  SettingsPermissions,
} from "@livingsites/application";
import { SystemRoles, type OrganizationId, type UserId, type WebsiteId } from "@livingsites/domain";
import { InMemoryMembershipRepository } from "@livingsites/test-support";

describe("AuthorizationService", () => {
  let membershipRepo: InMemoryMembershipRepository;
  let authService: AuthorizationService;

  beforeEach(() => {
    membershipRepo = new InMemoryMembershipRepository();
    authService = new AuthorizationService({
      membershipReader: membershipRepo,
    });
  });

  describe("Platform Super Admin", () => {
    it("allows any valid permission across any organization context", async () => {
      const decision = await authService.can({
        userId: "super-user-1" as UserId,
        organizationId: "org-any" as OrganizationId,
        permission: OrganizationPermissions.MembersRemove,
        platformRole: SystemRoles.PLATFORM_SUPER_ADMIN,
      });

      expect(decision.allowed).toBe(true);
    });

    it("allows super admin even when no organization is supplied", async () => {
      const decision = await authService.can({
        userId: "super-user-1" as UserId,
        permission: SettingsPermissions.Update,
        isPlatformSuperAdmin: true,
      });

      expect(decision.allowed).toBe(true);
    });
  });

  describe("Organization Roles", () => {
    const orgId = "org-1" as OrganizationId;
    const ownerId = "user-owner" as UserId;
    const adminId = "user-admin" as UserId;
    const editorId = "user-editor" as UserId;
    const viewerId = "user-viewer" as UserId;

    beforeEach(async () => {
      await membershipRepo.create({
        organizationId: orgId,
        userId: ownerId,
        role: "owner",
        status: "active",
      });

      await membershipRepo.create({
        organizationId: orgId,
        userId: adminId,
        role: "admin",
        status: "active",
      });

      await membershipRepo.create({
        organizationId: orgId,
        userId: editorId,
        role: "editor",
        status: "active",
      });

      await membershipRepo.create({
        organizationId: orgId,
        userId: viewerId,
        role: "viewer",
        status: "active",
      });
    });

    it("Owner has full organization, website, page, media, form, and settings permissions", async () => {
      const permsToCheck = [
        OrganizationPermissions.Read,
        OrganizationPermissions.Update,
        OrganizationPermissions.MembersRead,
        OrganizationPermissions.MembersInvite,
        OrganizationPermissions.MembersUpdate,
        OrganizationPermissions.MembersRemove,
        WebsitePermissions.Publish,
        PagePermissions.Archive,
        MediaPermissions.Delete,
        FormPermissions.Create,
        SettingsPermissions.Update,
      ];

      for (const perm of permsToCheck) {
        const dec = await authService.can({
          userId: ownerId,
          organizationId: orgId,
          permission: perm,
        });
        expect(dec.allowed, `Owner should have ${perm}`).toBe(true);
      }
    });

    it("Admin has full management permissions", async () => {
      const dec1 = await authService.can({
        userId: adminId,
        organizationId: orgId,
        permission: OrganizationPermissions.MembersInvite,
      });
      expect(dec1.allowed).toBe(true);

      const dec2 = await authService.can({
        userId: adminId,
        organizationId: orgId,
        permission: PagePermissions.Publish,
      });
      expect(dec2.allowed).toBe(true);
    });

    it("Editor can create and update content, but cannot manage organization members or settings", async () => {
      // Allowed content actions
      const contentPerms = [
        WebsitePermissions.Read,
        WebsitePermissions.Create,
        WebsitePermissions.Update,
        WebsitePermissions.Publish,
        PagePermissions.Create,
        PagePermissions.Update,
        PagePermissions.Publish,
        MediaPermissions.Upload,
        MediaPermissions.Delete,
        FormPermissions.Create,
      ];

      for (const perm of contentPerms) {
        const dec = await authService.can({
          userId: editorId,
          organizationId: orgId,
          permission: perm,
        });
        expect(dec.allowed, `Editor should have ${perm}`).toBe(true);
      }

      // Denied management actions
      const deniedPerms = [
        OrganizationPermissions.Update,
        OrganizationPermissions.MembersInvite,
        OrganizationPermissions.MembersUpdate,
        OrganizationPermissions.MembersRemove,
        SettingsPermissions.Update,
      ];

      for (const perm of deniedPerms) {
        const dec = await authService.can({
          userId: editorId,
          organizationId: orgId,
          permission: perm,
        });
        expect(dec.allowed, `Editor should NOT have ${perm}`).toBe(false);
        if (!dec.allowed) {
          expect(dec.code).toBe("permission_denied");
        }
      }
    });

    it("Viewer is read-only", async () => {
      // Allowed read actions
      const readPerms = [
        OrganizationPermissions.Read,
        OrganizationPermissions.MembersRead,
        WebsitePermissions.Read,
        PagePermissions.Read,
        MediaPermissions.Read,
        FormPermissions.Read,
        FormPermissions.SubmissionRead,
        SettingsPermissions.Read,
      ];

      for (const perm of readPerms) {
        const dec = await authService.can({
          userId: viewerId,
          organizationId: orgId,
          permission: perm,
        });
        expect(dec.allowed, `Viewer should have ${perm}`).toBe(true);
      }

      // Denied write actions
      const deniedPerms = [
        OrganizationPermissions.Update,
        OrganizationPermissions.MembersInvite,
        WebsitePermissions.Create,
        WebsitePermissions.Publish,
        PagePermissions.Create,
        PagePermissions.Archive,
        MediaPermissions.Upload,
        FormPermissions.Create,
        SettingsPermissions.Update,
      ];

      for (const perm of deniedPerms) {
        const dec = await authService.can({
          userId: viewerId,
          organizationId: orgId,
          permission: perm,
        });
        expect(dec.allowed, `Viewer should NOT have ${perm}`).toBe(false);
      }
    });
  });

  describe("Archived and Missing Memberships", () => {
    it("denies access if membership is archived", async () => {
      const orgId = "org-1" as OrganizationId;
      const userId = "user-archived" as UserId;

      const created = await membershipRepo.create({
        organizationId: orgId,
        userId,
        role: "admin",
        status: "active",
      });
      if (!created.ok) throw new Error("Failed create");

      await membershipRepo.archive(created.value.id, 1);

      const dec = await authService.can({
        userId,
        organizationId: orgId,
        permission: OrganizationPermissions.Read,
      });

      expect(dec.allowed).toBe(false);
      if (!dec.allowed) {
        expect(dec.code).toBe("no_active_membership");
      }
    });

    it("denies access if user has no membership in organization", async () => {
      const dec = await authService.can({
        userId: "stranger" as UserId,
        organizationId: "org-1" as OrganizationId,
        permission: OrganizationPermissions.Read,
      });

      expect(dec.allowed).toBe(false);
      if (!dec.allowed) {
        expect(dec.code).toBe("no_active_membership");
      }
    });
  });

  describe("Tenant Isolation and Scope Restrictions", () => {
    it("denies user from Org A accessing Org B", async () => {
      await membershipRepo.create({
        organizationId: "org-A" as OrganizationId,
        userId: "user-A" as UserId,
        role: "owner",
        status: "active",
      });

      const dec = await authService.can({
        userId: "user-A" as UserId,
        organizationId: "org-B" as OrganizationId,
        permission: OrganizationPermissions.Read,
      });

      expect(dec.allowed).toBe(false);
      if (!dec.allowed) {
        expect(dec.code).toBe("no_active_membership");
      }
    });

    it("restricts website-scoped membership from accessing other websites", async () => {
      await membershipRepo.create({
        organizationId: "org-1" as OrganizationId,
        userId: "user-scoped" as UserId,
        role: "editor",
        websiteScopeId: "site-101",
        status: "active",
      });

      // Target matching website -> allowed
      const allowedDec = await authService.can({
        userId: "user-scoped" as UserId,
        organizationId: "org-1" as OrganizationId,
        websiteId: "site-101" as WebsiteId,
        permission: PagePermissions.Create,
      });
      expect(allowedDec.allowed).toBe(true);

      // Target different website -> denied
      const deniedDec = await authService.can({
        userId: "user-scoped" as UserId,
        organizationId: "org-1" as OrganizationId,
        websiteId: "site-999" as WebsiteId,
        permission: PagePermissions.Create,
      });
      expect(deniedDec.allowed).toBe(false);
      if (!deniedDec.allowed) {
        expect(deniedDec.code).toBe("scope_mismatch");
      }
    });
  });

  describe("Unknown permissions and validation", () => {
    it("denies unknown permission keys", async () => {
      const dec = await authService.can({
        userId: "user-1" as UserId,
        organizationId: "org-1" as OrganizationId,
        permission: "wildcard.*",
      });

      expect(dec.allowed).toBe(false);
      if (!dec.allowed) {
        expect(dec.code).toBe("unknown_permission");
      }
    });
  });
});
