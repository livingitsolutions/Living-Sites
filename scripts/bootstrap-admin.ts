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
const organizationName = required("BOOTSTRAP_ORGANIZATION_NAME");
const organizationSlug = required("BOOTSTRAP_ORGANIZATION_SLUG").toLowerCase();
const connectionString = databaseUrl();
const betterAuthUrl = required("BETTER_AUTH_URL");

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

    if (identity?.disabled) throw new Error("The existing Better Auth identity is disabled.");

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

  if (user.status !== "active") throw new Error("The Platform User is not active.");

  await sql.begin(async (transaction) => {
    await transaction`UPDATE ba_user SET email_verified = true, updated_at = now() WHERE id = ${String(user.authSubjectId)}`;
    await transaction`
      INSERT INTO identity_linkages (
        id, auth_subject_id, email, display_name, status, platform_user_id,
        attempts, max_attempts, created_at, updated_at, completed_at
      ) VALUES (
        ${composition.idGenerator.generatePrefixed("linkage")}, ${String(user.authSubjectId)}, ${email},
        ${user.displayName}, 'linked', ${String(user.id)}, 0, 5, now(), now(), now()
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

  if (organization.status !== "active") throw new Error("The bootstrap organization is not active.");

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

  console.log("Initial administrator bootstrap complete.");
  console.log("Verified: Better Auth identity -> Platform User -> Organization -> active OWNER membership.");
} finally {
  await sql.end();
  await composition.close();
}
