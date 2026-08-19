import { describe, expect, it } from "vitest";
import type { Membership, Organization, OrganizationId, Plan, PlanId, UserId, Website, WebsiteDraft, WebsiteId } from "@livingsites/domain";
import { AuthorizationService } from "../../../authorization/service";
import { createWebsite } from "./use-case";

const orgA = "org_a" as OrganizationId;
const orgB = "org_b" as OrganizationId;
const planId = "plan_starter" as PlanId;
const now = "2026-08-19T00:00:00.000Z";

function organization(id: OrganizationId, status: Organization["status"] = "active"): Organization {
  return { id, slug: `${id}-slug` as Organization["slug"], name: String(id), billingEmail: "billing@example.com", planId, status, featureOverrides: [], version: 1, audit: { createdAt: now as Organization["audit"]["createdAt"], updatedAt: now as Organization["audit"]["updatedAt"] } };
}

const plan: Plan = {
  id: planId, tier: "starter", slug: "starter" as Plan["slug"], name: "Starter", description: "", priceMonthly: 0, priceAnnual: 0, currency: "usd", features: [], maxWebsites: 2, maxMembers: 5, customDomainsAllowed: false, isActive: true, version: 1, audit: { createdAt: now as Plan["audit"]["createdAt"], updatedAt: now as Plan["audit"]["updatedAt"] },
};

function membership(userId: UserId, organizationId: OrganizationId, role: Membership["role"], status: Membership["status"] = "active"): Membership {
  return { id: `mem_${userId}` as Membership["id"], organizationId, userId, role, websiteScopeId: null, status, version: 1, audit: { createdAt: now as Membership["audit"]["createdAt"], updatedAt: now as Membership["audit"]["updatedAt"] } };
}

function setup(options: { userId: UserId; role?: Membership["role"]; membershipOrg?: OrganizationId; membershipStatus?: Membership["status"]; superAdmin?: boolean; organizationStatus?: Organization["status"]; existing?: Website[] } ) {
  const memberships = options.role ? [membership(options.userId, options.membershipOrg ?? orgA, options.role, options.membershipStatus)] : [];
  const membershipReader = {
    async findForUserAndOrganization(organizationId: OrganizationId, userId: UserId) { return memberships.find((item) => item.organizationId === organizationId && item.userId === userId && item.status === "active") ?? null; },
    async listForUserAndOrganization(organizationId: OrganizationId, userId: UserId) { return memberships.filter((item) => item.organizationId === organizationId && item.userId === userId); },
  };
  const authorizationService = new AuthorizationService({ membershipReader, superAdminChecker: { isSuperAdmin: () => options.superAdmin ?? false } });
  const existing = options.existing ?? [];
  let persisted: Website | null = null;
  return {
    get persisted() { return persisted; },
    deps: {
      authenticatedUser: { userId: options.userId }, authorizationService,
      organizationReader: { async findById(id: OrganizationId) { return id === orgA ? organization(orgA, options.organizationStatus) : id === orgB ? organization(orgB) : null; }, async findBySlug() { return null; }, async list() { return { items: [], total: 0, page: 1, pageSize: 20, hasMore: false }; } },
      planReader: { async findById() { return plan; }, async findActiveById() { return plan; }, async listActive() { return [plan]; } },
      websiteReader: { async findById() { return null; }, async findByOrganizationAndSlug(id: OrganizationId, slug: string) { return existing.find((site) => site.organizationId === id && site.slug === slug) ?? null; }, async listForOrganization(id: OrganizationId) { return existing.filter((site) => site.organizationId === id); }, async findByDomain() { return null; } },
      websiteCreationPersistence: { async createWithEvent(draft: WebsiteDraft) { persisted = { ...draft, version: 1 }; return { ok: true as const, value: persisted }; } },
      clock: { nowIso: () => now }, idGenerator: { generatePrefixed: () => "web_created" },
    },
  };
}

describe("CreateWebsite authorization", () => {
  for (const role of ["owner", "admin", "editor"] as const) {
    it(`allows ${role} through the approved permission catalog`, async () => {
      const fixture = setup({ userId: `usr_${role}` as UserId, role });
      expect((await createWebsite({ organizationId: orgA, name: "Journal", slug: "journal" }, fixture.deps)).ok).toBe(true);
    });
  }

  it("denies viewer, cross-org, and archived membership", async () => {
    const viewer = setup({ userId: "usr_viewer" as UserId, role: "viewer" });
    expect((await createWebsite({ organizationId: orgA, name: "Journal", slug: "journal" }, viewer.deps)).ok).toBe(false);
    const crossOrg = setup({ userId: "usr_cross" as UserId, role: "owner", membershipOrg: orgA });
    expect((await createWebsite({ organizationId: orgB, name: "Journal", slug: "journal" }, crossOrg.deps)).ok).toBe(false);
    const archived = setup({ userId: "usr_archived" as UserId, role: "owner", membershipStatus: "archived" });
    expect((await createWebsite({ organizationId: orgA, name: "Journal", slug: "journal" }, archived.deps)).ok).toBe(false);
  });

  it("allows only the trusted super-admin checker path", async () => {
    const fixture = setup({ userId: "usr_super" as UserId, superAdmin: true });
    expect((await createWebsite({ organizationId: orgB, name: "Journal", slug: "journal" }, fixture.deps)).ok).toBe(true);
  });

  it("does not persist on inactive organization or duplicate slug", async () => {
    const inactive = setup({ userId: "usr_owner" as UserId, role: "owner", organizationStatus: "archived" });
    expect((await createWebsite({ organizationId: orgA, name: "Journal", slug: "journal" }, inactive.deps)).ok).toBe(false);
    expect(inactive.persisted).toBeNull();
    const seed = { id: "web_existing" as WebsiteId, organizationId: orgA, slug: "journal" } as Website;
    const duplicate = setup({ userId: "usr_owner" as UserId, role: "owner", existing: [seed] });
    expect((await createWebsite({ organizationId: orgA, name: "Journal", slug: "journal" }, duplicate.deps)).ok).toBe(false);
    expect(duplicate.persisted).toBeNull();
  });
});
