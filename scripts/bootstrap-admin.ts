#!/usr/bin/env node
import {
  composeProduction,
  reconcileProductionAdministrator,
  resolveTrustedOrigins,
} from "../packages/composition/src";

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

const email = required("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
const password = required("BOOTSTRAP_ADMIN_PASSWORD");
const displayName = required("BOOTSTRAP_ADMIN_NAME");
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

try {
  const result = await reconcileProductionAdministrator({
    email,
    displayName,
    organizationName: "Living IT Solutions",
    organizationSlug: "living-it-solutions",
    createdBy: "production_bootstrap",
  }, composition, {
    async createIdentity(input) {
      const registered = await composition.registerUser(
        { email: input.email, password, displayName: input.displayName },
        { ...composition.registerUserDeps, registrationMode: "open" },
      );
      if (!registered.ok) throw new Error(registered.error.message);
      return registered.value.user;
    },
  });

  console.log("Production administrator bootstrap complete.");
  console.log(`Better Auth identity: ${result.betterAuthIdentity.status}`);
  console.log(`Platform User: ${result.platformUser.status}`);
  console.log("Platform Super Admin: active singleton");
  console.log(`Organization: ${result.organization.status}`);
  console.log(`OWNER Membership: ${result.ownerMembership.status}`);
} finally {
  await composition.close();
}
