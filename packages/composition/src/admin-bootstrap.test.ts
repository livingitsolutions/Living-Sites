import type { Membership, Organization, User } from "@livingsites/domain";
import { describe, expect, it } from "vitest";
import type { ProductionComposition } from "./production.js";
import { AdminBootstrapError, reconcileProductionAdministrator } from "./admin-bootstrap.js";

const email = "livingitsolutions@gmail.com";
const now = "2026-08-19T00:00:00.000Z";

const user = {
  id: "user_admin",
  authSubjectId: "auth_admin",
  email,
  displayName: "Andrei Urgel",
  status: "active",
  version: 1,
  audit: { createdAt: now, updatedAt: now },
} as unknown as User;

const organization = {
  id: "org_living_it",
  slug: "living-it-solutions",
  name: "Living IT Solutions",
  billingEmail: email,
  planId: null,
  status: "active",
  featureOverrides: [],
  version: 1,
  audit: { createdAt: now, updatedAt: now },
} as unknown as Organization;

const membership = {
  id: "membership_owner",
  organizationId: organization.id,
  userId: user.id,
  role: "owner",
  websiteScopeId: null,
  status: "active",
  version: 1,
  audit: { createdAt: now, updatedAt: now },
} as unknown as Membership;

function verification() {
  return {
    identity_count: 1,
    credential_count: 1,
    platform_user_count: 1,
    super_admin_count: 1,
    intended_super_admin_count: 1,
    organization_count: 1,
    owner_membership_count: 1,
    super_admin_id: "super_admin_singleton",
    membership_id: String(membership.id),
  };
}

function createDatabaseQueue(repetitions: number) {
  const results = Array.from({ length: repetitions }, () => [
    [{ id: "auth_admin", name: "Andrei Urgel" }],
    [{ id: "auth_admin" }],
    [{ id: "user_admin" }],
    [],
    [],
    [verification()],
  ]).flat();

  const database = {
    async execute() {
      if (results.length === 0) throw new Error("Unexpected database query.");
      return results.shift();
    },
    async transaction(callback: (transaction: unknown) => Promise<unknown>) {
      return callback(database);
    },
  };
  return database;
}

function createComposition(options: { repetitions?: number; rejectSuperAdmin?: boolean } = {}) {
  let bootstrapCalls = 0;
  const database = createDatabaseQueue(options.repetitions ?? 1);
  const composition = {
    database,
    runWithTenantContext: async (_context: unknown, operation: () => Promise<unknown>) => operation(),
    idGenerator: {
      generatePrefixed(prefix: string) {
        return `${prefix}_generated`;
      },
    },
    clock: { nowIso: () => now },
    userReader: {
      findByEmail: async () => user,
    },
    userCreator: {
      create: async () => ({ ok: true, value: user }),
    },
    superAdminStore: {
      async bootstrap() {
        bootstrapCalls += 1;
        if (options.rejectSuperAdmin) {
          return {
            ok: false,
            error: {
              code: "bootstrap_locked",
              message: "Platform Super Admin has already been bootstrapped.",
            },
          };
        }
        return { ok: true, value: { user, alreadyExisted: bootstrapCalls > 1 } };
      },
    },
    organizationRepository: {
      findBySlug: async () => organization,
    },
    createOrganization: async () => ({ ok: true, value: { organization } }),
    createOrganizationDeps: {},
    membershipRepository: {
      findForUserAndOrganization: async () => membership,
      create: async () => ({ ok: true, value: membership }),
      changeRole: async () => ({ ok: true, value: membership }),
    },
  } as unknown as ProductionComposition;
  return composition;
}

const input = {
  email,
  displayName: "Andrei Urgel",
  organizationName: "Living IT Solutions",
  organizationSlug: "living-it-solutions",
};

describe("reconcileProductionAdministrator", () => {
  it("reconciles the complete production administrator chain", async () => {
    const result = await reconcileProductionAdministrator(input, createComposition());

    expect(result).toEqual({
      betterAuthIdentity: { id: "auth_admin", status: "active", verified: true },
      platformUser: { id: "user_admin", status: "active" },
      platformSuperAdmin: { id: "super_admin_singleton", status: "active", singleton: true },
      organization: { id: "org_living_it", status: "active" },
      ownerMembership: { id: "membership_owner", status: "active", role: "owner" },
      alreadyReconciled: false,
    });
  });

  it("returns the same chain on an idempotent retry", async () => {
    const composition = createComposition({ repetitions: 2 });

    const first = await reconcileProductionAdministrator(input, composition);
    const second = await reconcileProductionAdministrator(input, composition);

    expect(second).toMatchObject({
      betterAuthIdentity: first.betterAuthIdentity,
      platformUser: first.platformUser,
      platformSuperAdmin: first.platformSuperAdmin,
      organization: first.organization,
      ownerMembership: first.ownerMembership,
      alreadyReconciled: true,
    });
  });

  it("rejects a different second Platform Super Admin", async () => {
    await expect(reconcileProductionAdministrator({
      ...input,
      email: "different-admin@example.com",
    }, createComposition({ rejectSuperAdmin: true }))).rejects.toMatchObject({
      code: "bootstrap_locked",
    } satisfies Partial<AdminBootstrapError>);
  });
});
