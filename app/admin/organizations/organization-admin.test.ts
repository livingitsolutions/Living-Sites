import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NetlifyDB } from "@netlify/database-dev";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { composeProduction, type ProductionComposition } from "@livingsites/composition";
import * as schema from "../../../packages/infrastructure/src/db/schema";
import { evaluateAuthPageRequest } from "../../lib/auth-page-request";
import {
  createOrganizationDraft,
  createUserDraft,
  createMembershipDraft,
  type OrganizationId,
  type UserId,
  type MembershipId,
  type AuthSubjectId,
  type Slug,
  type ISODateString,
} from "@livingsites/domain";
import { OrganizationPermissions, WebsitePermissions } from "@livingsites/application";

const baseURL = "http://localhost:3000";

describe("Organization-scoped Admin Route Protection", () => {
  let netlifyDB: NetlifyDB;
  let sqlClient: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let composition: ProductionComposition;

  const orgA = "org-alpha" as OrganizationId;
  const orgB = "org-beta" as OrganizationId;
  const userA = "user-alpha" as UserId;
  const userB = "user-beta" as UserId;
  const userViewer = "user-viewer" as UserId;
  const userEditor = "user-editor" as UserId;

  beforeAll(async () => {
    netlifyDB = new NetlifyDB({ logger: () => {} });
    const connectionString = await netlifyDB.start();
    await netlifyDB.applyMigrations("./netlify/database/migrations");
    sqlClient = postgres(connectionString);
    db = drizzle({ client: sqlClient, schema });
    composition = composeProduction({
      connectionString,
      betterAuthSecret: "admin-route-test-secret-at-least-32-chars",
      betterAuthUrl: baseURL,
      trustedOrigins: [baseURL],
      registrationMode: "open",
      logLevel: "silent",
    });
  });

  afterAll(async () => {
    if (sqlClient) await sqlClient.end();
    if (composition) await composition.close();
    if (netlifyDB) await netlifyDB.stop();
  });

  beforeEach(async () => {
    await db.delete(schema.platformSuperAdmins);
    await db.delete(schema.applicationOutbox);
    await db.delete(schema.websites);
    await db.delete(schema.memberships);
    await db.delete(schema.platformUsers);
    await db.delete(schema.organizations);
    await db.delete(schema.betterAuthSessions);
    await db.delete(schema.betterAuthUsers);

    // Create organizations
    await composition.organizationRepository.create(
      createOrganizationDraft({
        id: orgA,
        name: "Alpha Org",
        slug: "alpha-org" as Slug,
        billingEmail: "billing@alpha.test",
        planId: null,
        now: "2026-08-19T00:00:00Z" as ISODateString,
      }),
    );
    await composition.organizationRepository.create(
      createOrganizationDraft({
        id: orgB,
        name: "Beta Org",
        slug: "beta-org" as Slug,
        billingEmail: "billing@beta.test",
        planId: null,
        now: "2026-08-19T00:00:00Z" as ISODateString,
      }),
    );

    // Create users
    await composition.userCreator.create(
      createUserDraft({
        id: userA,
        authSubjectId: "ba-user-alpha" as AuthSubjectId,
        email: "alpha@example.com",
        displayName: "Alpha Owner",
        now: "2026-08-19T00:00:00Z" as ISODateString,
      }),
    );
    await composition.userCreator.create(
      createUserDraft({
        id: userB,
        authSubjectId: "ba-user-beta" as AuthSubjectId,
        email: "beta@example.com",
        displayName: "Beta Owner",
        now: "2026-08-19T00:00:00Z" as ISODateString,
      }),
    );
    await composition.userCreator.create(
      createUserDraft({
        id: userViewer,
        authSubjectId: "ba-user-viewer" as AuthSubjectId,
        email: "viewer@example.com",
        displayName: "Alpha Viewer",
        now: "2026-08-19T00:00:00Z" as ISODateString,
      }),
    );
    await composition.userCreator.create(
      createUserDraft({
        id: userEditor,
        authSubjectId: "ba-user-editor" as AuthSubjectId,
        email: "editor@example.com",
        displayName: "Alpha Editor",
        now: "2026-08-19T00:00:00Z" as ISODateString,
      }),
    );

    // Create memberships
    await composition.membershipRepository.create(
      createMembershipDraft({
        id: "mem-alpha-owner" as MembershipId,
        organizationId: orgA,
        userId: userA,
        role: "owner",
        now: "2026-08-19T00:00:00Z" as ISODateString,
      }),
    );
    await composition.membershipRepository.create(
      createMembershipDraft({
        id: "mem-alpha-viewer" as MembershipId,
        organizationId: orgA,
        userId: userViewer,
        role: "viewer",
        now: "2026-08-19T00:00:00Z" as ISODateString,
      }),
    );
    await composition.membershipRepository.create(
      createMembershipDraft({
        id: "mem-alpha-editor" as MembershipId,
        organizationId: orgA,
        userId: userEditor,
        role: "editor",
        now: "2026-08-19T00:00:00Z" as ISODateString,
      }),
    );
    await composition.membershipRepository.create(
      createMembershipDraft({
        id: "mem-beta-owner" as MembershipId,
        organizationId: orgB,
        userId: userB,
        role: "owner",
        now: "2026-08-19T00:00:00Z" as ISODateString,
      }),
    );
  });

  it("unauthenticated request to /admin/organizations/:id redirects to /login", async () => {
    const request = new Request(`${baseURL}/admin/organizations/${orgA}`);
    const decision = await evaluateAuthPageRequest(request, composition.authInstance);
    expect(decision).toEqual({ kind: "redirect", location: "/login" });
  });

  it("server-side authorization blocks user from Org B accessing Org A", async () => {
    // User B is authenticated, but belongs to Org B
    const decision = await composition.authorizationService.can({
      userId: userB,
      organizationId: orgA,
      permission: OrganizationPermissions.Read,
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe("no_active_membership");
    }
  });

  it("server-side authorization allows Org A owner and grants member management", async () => {
    const readDecision = await composition.authorizationService.can({
      userId: userA,
      organizationId: orgA,
      permission: OrganizationPermissions.Read,
    });
    expect(readDecision.allowed).toBe(true);

    const updateDecision = await composition.authorizationService.can({
      userId: userA,
      organizationId: orgA,
      permission: OrganizationPermissions.MembersUpdate,
    });
    expect(updateDecision.allowed).toBe(true);
  });

  it("server-side authorization gives Viewer read-only access and denies member management", async () => {
    const readDecision = await composition.authorizationService.can({
      userId: userViewer,
      organizationId: orgA,
      permission: OrganizationPermissions.Read,
    });
    expect(readDecision.allowed).toBe(true);

    const manageDecision = await composition.authorizationService.can({
      userId: userViewer,
      organizationId: orgA,
      permission: OrganizationPermissions.MembersUpdate,
    });
    expect(manageDecision.allowed).toBe(false);

    const createWebsiteDecision = await composition.authorizationService.can({
      userId: userViewer,
      organizationId: orgA,
      permission: WebsitePermissions.Create,
    });
    expect(createWebsiteDecision.allowed).toBe(false);
  });

  it("server-side authorization denies Editor member management", async () => {
    const manageDecision = await composition.authorizationService.can({
      userId: userEditor,
      organizationId: orgA,
      permission: OrganizationPermissions.MembersUpdate,
    });
    expect(manageDecision.allowed).toBe(false);

    const createWebsiteDecision = await composition.authorizationService.can({
      userId: userEditor,
      organizationId: orgA,
      permission: WebsitePermissions.Create,
    });
    expect(createWebsiteDecision.allowed).toBe(true);
  });

  it("authorized user creates a Website and duplicate slug returns a typed error", async () => {
    const deps = {
      authenticatedUser: { userId: userA },
      authorizationService: composition.authorizationService,
      organizationReader: composition.organizationRepository,
      planReader: composition.planReader,
      websiteReader: composition.websiteRepository,
      websiteCreationPersistence: composition.websiteCreationPersistence,
      clock: composition.clock,
      idGenerator: composition.idGenerator,
    };
    const created = await composition.createWebsite({ organizationId: orgA, name: "Alpha Website", slug: "alpha-website" }, deps);
    expect(created.ok).toBe(true);
    const duplicate = await composition.createWebsite({ organizationId: orgA, name: "Duplicate", slug: "alpha-website" }, deps);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.error.code).toBe("duplicate_slug");
  });

  it("archived membership is denied", async () => {
    const membership = await composition.membershipRepository.findForUserAndOrganization(orgA, userViewer);
    expect(membership).not.toBeNull();
    if (!membership) return;
    await composition.membershipRepository.archive(membership.id, membership.version);
    const decision = await composition.authorizationService.can({ userId: userViewer, organizationId: orgA, permission: OrganizationPermissions.Read });
    expect(decision.allowed).toBe(false);
  });

  it("server-side authorization grants Platform Super Admin access across any organization", async () => {
    const bootstrapRes = await composition.superAdminStore.bootstrap({
      email: "super@platform.admin",
      displayName: "Platform Admin",
    });
    expect(bootstrapRes.ok).toBe(true);
    if (!bootstrapRes.ok) return;

    const superAdminUser = bootstrapRes.value.user;

    const decisionA = await composition.authorizationService.can({
      userId: superAdminUser.id,
      organizationId: orgA,
      permission: OrganizationPermissions.Read,
    });
    expect(decisionA.allowed).toBe(true);

    const decisionB = await composition.authorizationService.can({
      userId: superAdminUser.id,
      organizationId: orgB,
      permission: OrganizationPermissions.Read,
    });
    expect(decisionB.allowed).toBe(true);
  });
});
