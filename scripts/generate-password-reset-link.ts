#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { generateAdminPasswordResetLink } from "@livingsites/application";
import type { PasswordResetEmailPort } from "@livingsites/application";
import { composeProduction } from "../packages/composition/src/production";
import { execNetlifyCli } from "./netlify-cli";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function productionDatabaseUrl(): string {
  const configured = process.env.NETLIFY_DB_URL;
  if (configured) return configured;

  const branch = option("--branch") ?? "staging";
  const output = execNetlifyCli(["database", "status", "--branch", branch, "--show-credentials", "--json"]);
  const status = JSON.parse(output) as { database?: { connectionString?: string } };
  if (!status.database?.connectionString) throw new Error("Production Netlify Database credentials are unavailable.");
  return status.database.connectionString;
}

async function main(): Promise<void> {
  if (option("--production") !== "living-cms") {
    throw new Error("Pass --production living-cms to confirm the production target.");
  }

  const email = option("--email");
  if (!email) throw new Error("Pass --email <address>.");

  const connectionString = productionDatabaseUrl();
  const betterAuthUrl = option("--url") ?? "https://living-cms.netlify.app";
  let capturedResetUrl: string | undefined;
  const passwordResetEmailAdapter: PasswordResetEmailPort = {
    async sendPasswordResetEmail(input) {
      capturedResetUrl = input.resetUrl;
    },
  };

  const composition = composeProduction({
    connectionString,
    betterAuthSecret: randomBytes(48).toString("base64url"),
    betterAuthUrl,
    trustedOrigins: [new URL(betterAuthUrl).origin],
    registrationMode: "disabled",
    emailVerificationEnabled: false,
    passwordResetEmailAdapter,
    logLevel: "silent",
  });
  const sql = postgres(connectionString, { max: 1 });

  try {
    const resetUrl = await generateAdminPasswordResetLink(email, {
      async isPlatformSuperAdmin(normalizedEmail) {
        const [row] = await sql<{ count: number }[]>`
          SELECT count(*)::int AS count
          FROM platform_super_admins psa
          JOIN platform_users pu ON pu.id = psa.user_id
          JOIN ba_user bu ON bu.id = pu.auth_subject_id
          WHERE lower(psa.email) = ${normalizedEmail}
            AND lower(pu.email) = ${normalizedEmail}
            AND lower(bu.email) = ${normalizedEmail}
            AND pu.status = 'active'
            AND bu.disabled = false
        `;
        return row?.count === 1;
      },
      async requestPasswordReset(normalizedEmail) {
        await composition.authInstance.api.requestPasswordReset({
          body: {
            email: normalizedEmail,
            redirectTo: new URL("/reset-password", betterAuthUrl).toString(),
          },
        });
      },
      readCapturedResetUrl() {
        return capturedResetUrl;
      },
    });

    process.stdout.write(`${resetUrl}\n`);
  } finally {
    await sql.end();
    await composition.close();
  }
}

await main();
