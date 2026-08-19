import { describe, it, expect, beforeEach } from "vitest";
import { addOrganizationMember, changeOrganizationMemberRole, removeOrganizationMember, getOrganizationMembers, AuthorizationService, } from "@livingsites/application";
import { InMemoryMembershipRepository, InMemoryUserRepository, InMemoryEventPublisher, FakeClock, DeterministicIdGenerator, } from "@livingsites/test-support";
describe("Membership Use Cases", () => {
    let membershipRepo;
    let userRepo;
    let eventPublisher;
    let clock;
    let idGenerator;
    let authService;
    const orgA = "org-A";
    const orgB = "org-B";
    const ownerA = "user-owner-A";
    const adminA = "user-admin-A";
    const editorA = "user-editor-A";
    const viewerA = "user-viewer-A";
    const callerB = "user-owner-B";
    beforeEach(async () => {
        membershipRepo = new InMemoryMembershipRepository();
        userRepo = new InMemoryUserRepository();
        eventPublisher = new InMemoryEventPublisher();
        clock = new FakeClock(1000);
        idGenerator = new DeterministicIdGenerator();
        authService = new AuthorizationService({ membershipReader: membershipRepo });
        // Seed users in userRepo
        await userRepo.create({
            id: ownerA,
            authSubjectId: "auth-owner-a",
            email: "owner-a@example.com",
            displayName: "Owner A",
            status: "active",
            version: 0,
            audit: { createdAt: "2026-08-19T00:00:00Z", updatedAt: "2026-08-19T00:00:00Z" },
        });
        await userRepo.create({
            id: adminA,
            authSubjectId: "auth-admin-a",
            email: "admin-a@example.com",
            displayName: "Admin A",
            status: "active",
            version: 0,
            audit: { createdAt: "2026-08-19T00:00:00Z", updatedAt: "2026-08-19T00:00:00Z" },
        });
        await userRepo.create({
            id: editorA,
            authSubjectId: "auth-editor-a",
            email: "editor-a@example.com",
            displayName: "Editor A",
            status: "active",
            version: 0,
            audit: { createdAt: "2026-08-19T00:00:00Z", updatedAt: "2026-08-19T00:00:00Z" },
        });
        // Seed initial memberships in org A
        await membershipRepo.create({
            id: "mem-owner-a",
            organizationId: orgA,
            userId: ownerA,
            role: "owner",
            status: "active",
        });
        await membershipRepo.create({
            id: "mem-admin-a",
            organizationId: orgA,
            userId: adminA,
            role: "admin",
            status: "active",
        });
        // Seed org B membership
        await membershipRepo.create({
            id: "mem-owner-b",
            organizationId: orgB,
            userId: callerB,
            role: "owner",
            status: "active",
        });
    });
    describe("AddOrganizationMember", () => {
        it("allows Owner to add a new member and emits OrganizationMemberAdded event", async () => {
            const res = await addOrganizationMember({
                organizationId: orgA,
                userId: editorA,
                role: "editor",
                callerUserId: ownerA,
            }, {
                membershipRepository: membershipRepo,
                userReader: userRepo,
                authorizationService: authService,
                eventPublisher,
                clock,
                idGenerator,
            });
            expect(res.ok).toBe(true);
            if (!res.ok)
                return;
            expect(res.value.membership.role).toBe("editor");
            expect(res.value.membership.organizationId).toBe(orgA);
            expect(res.value.membership.userId).toBe(editorA);
            expect(res.value.membership.version).toBe(1);
            // Verify event emission
            expect(eventPublisher.published).toHaveLength(1);
            expect(eventPublisher.published[0]?.type).toBe("organization.member_added");
        });
        it("rejects caller lacking invite permission", async () => {
            // Create a viewer in org A
            await membershipRepo.create({
                id: "mem-viewer-a",
                organizationId: orgA,
                userId: viewerA,
                role: "viewer",
                status: "active",
            });
            const res = await addOrganizationMember({
                organizationId: orgA,
                userId: editorA,
                role: "editor",
                callerUserId: viewerA,
            }, {
                membershipRepository: membershipRepo,
                userReader: userRepo,
                authorizationService: authService,
                eventPublisher,
                clock,
                idGenerator,
            });
            expect(res.ok).toBe(false);
            if (!res.ok) {
                expect("code" in res.error && res.error.code).toBe("unauthorized");
            }
        });
        it("rejects caller from another organization (tenant isolation)", async () => {
            const res = await addOrganizationMember({
                organizationId: orgA,
                userId: editorA,
                role: "editor",
                callerUserId: callerB, // user from org B
            }, {
                membershipRepository: membershipRepo,
                userReader: userRepo,
                authorizationService: authService,
                eventPublisher,
                clock,
                idGenerator,
            });
            expect(res.ok).toBe(false);
            if (!res.ok) {
                expect("code" in res.error && res.error.code).toBe("unauthorized");
            }
        });
        it("rejects duplicate active membership", async () => {
            const res = await addOrganizationMember({
                organizationId: orgA,
                userId: adminA, // already member
                role: "viewer",
                callerUserId: ownerA,
            }, {
                membershipRepository: membershipRepo,
                userReader: userRepo,
                authorizationService: authService,
                eventPublisher,
                clock,
                idGenerator,
            });
            expect(res.ok).toBe(false);
            if (!res.ok) {
                expect("code" in res.error && res.error.code).toBe("duplicate_membership");
            }
        });
    });
    describe("ChangeOrganizationMemberRole", () => {
        it("allows Owner to change member role and emits OrganizationMemberRoleChanged event", async () => {
            const res = await changeOrganizationMemberRole({
                membershipId: "mem-admin-a",
                newRole: "editor",
                expectedVersion: 1,
                callerUserId: ownerA,
            }, {
                membershipRepository: membershipRepo,
                authorizationService: authService,
                eventPublisher,
                clock,
            });
            expect(res.ok).toBe(true);
            if (!res.ok)
                return;
            expect(res.value.membership.role).toBe("editor");
            expect(res.value.membership.version).toBe(2);
            expect(eventPublisher.published).toHaveLength(1);
            expect(eventPublisher.published[0]?.type).toBe("organization.member_role_changed");
        });
        it("prevents demoting the sole remaining owner", async () => {
            const res = await changeOrganizationMemberRole({
                membershipId: "mem-owner-a",
                newRole: "admin",
                expectedVersion: 1,
                callerUserId: ownerA,
            }, {
                membershipRepository: membershipRepo,
                authorizationService: authService,
                eventPublisher,
                clock,
            });
            expect(res.ok).toBe(false);
            if (!res.ok) {
                expect("code" in res.error && res.error.code).toBe("cannot_demote_sole_owner");
            }
        });
        it("rejects mutation on version mismatch (optimistic concurrency)", async () => {
            const res = await changeOrganizationMemberRole({
                membershipId: "mem-admin-a",
                newRole: "editor",
                expectedVersion: 99, // wrong version
                callerUserId: ownerA,
            }, {
                membershipRepository: membershipRepo,
                authorizationService: authService,
                eventPublisher,
                clock,
            });
            expect(res.ok).toBe(false);
            if (!res.ok) {
                expect("expectedVersion" in res.error).toBe(true);
            }
        });
    });
    describe("RemoveOrganizationMember", () => {
        it("allows Owner to remove a member and emits OrganizationMemberRemoved event", async () => {
            const res = await removeOrganizationMember({
                membershipId: "mem-admin-a",
                expectedVersion: 1,
                callerUserId: ownerA,
            }, {
                membershipRepository: membershipRepo,
                authorizationService: authService,
                eventPublisher,
                clock,
            });
            expect(res.ok).toBe(true);
            expect(eventPublisher.published).toHaveLength(1);
            expect(eventPublisher.published[0]?.type).toBe("organization.member_removed");
            const active = await membershipRepo.findForUserAndOrganization(orgA, adminA);
            expect(active).toBeNull();
        });
        it("prevents removing the sole remaining owner", async () => {
            const res = await removeOrganizationMember({
                membershipId: "mem-owner-a",
                expectedVersion: 1,
                callerUserId: ownerA,
            }, {
                membershipRepository: membershipRepo,
                authorizationService: authService,
                eventPublisher,
                clock,
            });
            expect(res.ok).toBe(false);
            if (!res.ok) {
                expect("code" in res.error && res.error.code).toBe("cannot_remove_sole_owner");
            }
        });
    });
    describe("GetOrganizationMembers", () => {
        it("allows member with MembersRead permission to list org members", async () => {
            const res = await getOrganizationMembers({
                organizationId: orgA,
                callerUserId: ownerA,
            }, {
                membershipRepository: membershipRepo,
                authorizationService: authService,
            });
            expect(res.ok).toBe(true);
            if (!res.ok)
                return;
            expect(res.value.members.length).toBeGreaterThanOrEqual(2);
        });
        it("rejects caller from outside the organization (tenant isolation)", async () => {
            const res = await getOrganizationMembers({
                organizationId: orgA,
                callerUserId: callerB,
            }, {
                membershipRepository: membershipRepo,
                authorizationService: authService,
            });
            expect(res.ok).toBe(false);
            if (!res.ok) {
                expect(res.error.code).toBe("unauthorized");
            }
        });
    });
});
//# sourceMappingURL=membership.test.js.map