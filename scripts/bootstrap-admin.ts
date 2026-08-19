#!/usr/bin/env node
import postgres from "postgres";
import { createMembershipDraft, createUserDraft } from "@livingsites/domain";
import type { AuthSubjectId, ISODateString, MembershipId, UserId } from "@livingsites/domain";
import { composeProduction, resolveTrustedOrigins } from "../packages/composition/src/production";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function databaseUrl(): string {
  const value = process.env.NETLIFY_DB_URL
    ?? process.env.NETLIFY_AGENT_RUNNER_DB_CONNECTION_STRING
    ?? process.env.DATABASE_URL;
  if (!value) throw new Error("Missing required environment variable: NETLIFY_DB_URL");
  return value;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const candidate = error as { code?: string; message?: string };
    return candidate.message ?? candidate.code ?? "Unknown persistence error";
  }
  return String(error);
}

const email = required("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
const password = required("BOOTSTRAP_ADMIN_PASSWORD");
const displayName = required("BOOTSTRAP_ADMIN_NAME");
const organizationName = "Living IT Solutions";
const organizationSlug = "living-it-solutions";
const connectionString = databaseUrl();
const betterAuthUrl = required("BETTER_AUTH_URL");

if (required("BOOTSTRAP_ADMIN_CONFIRM_PRODUCTION") !== "living-cms") {
  throw new Error("BOOTSTRAP_ADMIN_CONFIRM_PRODUCTION must equal living-cms.");
}

if (process.env.EMAIL_VERIFICATION_ENABLED === "true") {
  throw new Error("Bootstrap requires EMAIL_VERIFICATION_ENABLED=false unless a production email adapter is configured.");
}

const composition = composeProduction({
  connectionString,
  betterAuthSecret: required("BETTER_AUTH_SECRET"),
  betterAuthUrl,
  trustedOrigins: resolveTrustedOrigins(process.env, betterAuthUrl),
  registrationMode: "open",
  emailVerificationEnabled: false,
  logLevel: "warn",
});
const sql = postgres(connectionString, { max: 1 });

try {
  let user = await composition.userReader.findByEmail(email);

  if (!user) {
    const [identity] = await sql<{ id: string; name: string; disabled: boolean }[]>`
      SELECT id, name, disabled FROM ba_user WHERE lower(email) = ${email} LIMIT 1
    `;

    if (identity) {
      const draft = createUserDraft({
        id: composition.idGenerator.generatePrefixed("user") as UserId,
        authSubjectId: identity.id as AuthSubjectId,
        email,
        displayName: identity.name || displayName,
        now: composition.clock.nowIso() as ISODateString,
      });
      const created = await composition.userCreator.create(draft);
      if (!created.ok) throw new Error(created.error.message);
      user = created.value;
    } else {
      const registered = await composition.registerUser(
        { email, password, displayName },
        { ...composition.registerUserDeps, registrationMode: "open" },
      );
      if (!registered.ok) throw new Error(registered.error.message);
      user = registered.value.user;
    }
  }

  if (!user) throw new Error("The intended Platform User could not be resolved.");
  const resolvedUser = user;

  await sql.begin(async (transaction) => {
    const identities = await transaction<{ id: string }[]>`
      UPDATE ba_user
      SET name = ${displayName}, email_verified = true, disabled = false, disabled_at = NULL, updated_at = now()
      WHERE id = ${String(resolvedUser.authSubjectId)} AND lower(email) = ${email}
      RETURNING id
    `;
    if (identities.length !== 1) throw new Error("The intended Better Auth identity could not be reconciled.");

    const users = await transaction<{ id: string }[]>`
      UPDATE platform_users
      SET display_name = ${displayName}, status = 'active', deleted_at = NULL, updated_at = now()
      WHERE id = ${String(resolvedUser.id)} AND auth_subject_id = ${String(resolvedUser.authSubjectId)} AND lower(email) = ${email}
      RETURNING id
    `;
    if (users.length !== 1) throw new Error("The intended Platform User could not be reconciled.");

    await transaction`
      INSERT INTO identity_linkages (
        id, auth_subject_id, email, display_name, status, platform_user_id,
        attempts, max_attempts, created_at, updated_at, completed_at
      ) VALUES (
        ${composition.idGenerator.generatePrefixed("linkage")}, ${String(resolvedUser.authSubjectId)}, ${email},
        ${displayName}, 'linked', ${String(resolvedUser.id)}, 0, 5, now(), now(), now()
      )
      ON CONFLICT (auth_subject_id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        status = 'linked',
        platform_user_id = EXCLUDED.platform_user_id,
        failure_reason = NULL,
        next_attempt_at = NULL,
        updated_at = now(),
        completed_at = now()
    `;
  });

  user = await composition.userReader.findByEmail(email);
  if (!user || user.status !== "active") throw new Error("The Platform User is not active after reconciliation.");

  const superAdmin = await composition.superAdminStore.bootstrap({
    email,
    displayName,
    createdBy: "production_bootstrap",
  });
  if (!superAdmin.ok) throw new Error(superAdmin.error.message);
  if (String(superAdmin.value.user.id) !== String(user.id)) {
    throw new Error("The Platform Super Admin is linked to a different Platform User.");
  }

  let organization = await composition.organizationRepository.findBySlug(organizationSlug);
  if (!organization) {
    const created = await composition.createOrganization({
      name: organizationName,
      slug: organizationSlug,
      billingEmail: email,
    }, composition.createOrganizationDeps);
    if (!created.ok) throw new Error(created.error.message);
    organization = created.value.organization;
  }

  await sql`
    UPDATE organizations
    SET name = ${organizationName}, billing_email = ${email}, status = 'active', deleted_at = NULL, updated_at = now()
    WHERE id = ${String(organization.id)} AND slug = ${organizationSlug}
  `;

  organization = await composition.organizationRepository.findBySlug(organizationSlug);
  if (!organization || organization.status !== "active") {
    throw new Error("The bootstrap organization is not active after reconciliation.");
  }

  const existingMembership = await composition.membershipRepository.findForUserAndOrganization(
    organization.id,
    user.id,
  );

  if (!existingMembership) {
    const membership = createMembershipDraft({
      id: composition.idGenerator.generatePrefixed("membership") as MembershipId,
      organizationId: organization.id,
      userId: user.id,
      role: "owner",
      now: composition.clock.nowIso() as ISODateString,
      createdBy: user.id,
    });
    const created = await composition.membershipRepository.create(membership);
    if (!created.ok) throw new Error(created.error.message);
  } else if (String(existingMembership.role).toLowerCase() !== "owner") {
    const changed = await composition.membershipRepository.changeRole(
      existingMembership.id,
      "owner",
      existingMembership.version,
    );
    if (!changed.ok) throw new Error(errorMessage(changed.error));
  }

  const [verification] = await sql<{
    identity_count: number;
    credential_count: number;
    platform_user_count: number;
    super_admin_count: number;
    intended_super_admin_count: number;
    organization_count: number;
    owner_membership_count: number;
  }[]>`
    SELECT
      (SELECT count(*)::int FROM ba_user
        WHERE id = ${String(user.authSubjectId)} AND lower(email) = ${email}
          AND disabled = false AND email_verified = true) AS identity_count,
      (SELECT count(*)::int FROM ba_account
        WHERE user_id = ${String(user.authSubjectId)} AND provider_id = 'credential'
          AND password IS NOT NULL) AS credential_count,
      (SELECT count(*)::int FROM platform_users
        WHERE id = ${String(user.id)} AND auth_subject_id = ${String(user.authSubjectId)}
          AND lower(email) = ${email} AND status = 'active') AS platform_user_count,
      (SELECT count(*)::int FROM platform_super_admins) AS super_admin_count,
      (SELECT count(*)::int FROM platform_super_admins
        WHERE user_id = ${String(user.id)} AND lower(email) = ${email}) AS intended_super_admin_count,
      (SELECT count(*)::int FROM organizations
        WHERE id = ${String(organization.id)} AND slug = ${organizationSlug}
          AND name = ${organizationName} AND status = 'active') AS organization_count,
      (SELECT count(*)::int FROM memberships
        WHERE organization_id = ${String(organization.id)} AND user_id = ${String(user.id)}
          AND website_scope_id IS NULL AND status = 'active' AND role = 'owner') AS owner_membership_count
  `;

  if (!verification
    || verification.identity_count !== 1
    || verification.credential_count < 1
    || verification.platform_user_count !== 1
    || verification.super_admin_count !== 1
    || verification.intended_super_admin_count !== 1
    || verification.organization_count !== 1
    || verification.owner_membership_count !== 1) {
    throw new Error("Bootstrap database verification failed.");
  }

  console.log("Production administrator bootstrap complete.");
  console.log("Better Auth identity: active");
  console.log("Platform User: active");
  console.log("Platform Super Admin: active singleton");
  console.log("Organization: active");
  console.log("OWNER Membership: active");
} finally {
  await sql.end();
  await composition.close();
}
