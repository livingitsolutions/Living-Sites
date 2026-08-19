/**
 * Auth integration tests using @netlify/database-dev.
 *
 * Tests the real Better Auth + Drizzle + Netlify Database flow:
 * - register (password hashing, session creation)
 * - duplicate email
 * - sign-in (valid, invalid password)
 * - session lookup
 * - sign-out
 * - session revocation
 * - email verification
 * - Platform User linkage
 *
 * Uses @netlify/database-dev to provision a local test database.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { NetlifyDB } from "@netlify/database-dev";
import { betterAuth } from "better-auth";
import type { BetterAuthInstance } from "../../adapters/better-auth";
import { eq } from "drizzle-orm";
import { NoopLogger } from "@livingsites/platform";
import { DrizzleUserRepository } from "../user/drizzle-user-repository";
import { BetterAuthAdapter, asBetterAuthInstance, createBetterAuthDatabaseAdapter } from "../../adapters/better-auth";
import { platformUsers, betterAuthUsers, betterAuthSessions, betterAuthAccounts, betterAuthVerifications } from "../../db/schema";
import { identityLinkages } from "../../db/identity-linkage-schema";
import * as schema from "../../db/schema";
import { createUserDraft } from "@livingsites/domain";
import type { UserId, AuthSubjectId, ISODateString } from "@livingsites/domain";

const TEST_SECRET = "test-secret-at-least-32-characters-long-xxxxx";
const TEST_URL = "http://localhost:3000";

describe("Better Auth + Drizzle integration", () => {
  let netlifyDB: NetlifyDB;
  let sql: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let authAdapter: BetterAuthAdapter;
  let auth: BetterAuthInstance;
  let userRepo: DrizzleUserRepository;
  let resetUrls: string[];

  beforeAll(async () => {
    netlifyDB = new NetlifyDB({ logger: () => {} });
    const connectionString = await netlifyDB.start();
    await netlifyDB.applyMigrations("./netlify/database/migrations");
    sql = postgres(connectionString);
    db = drizzle({ client: sql, schema });

    const rawAuth = betterAuth({
      secret: TEST_SECRET,
      baseURL: TEST_URL,
      trustedOrigins: [TEST_URL],
      database: createBetterAuthDatabaseAdapter(db),
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        minPasswordLength: 12,
        maxPasswordLength: 256,
        resetPasswordTokenExpiresIn: 3600,
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: async ({ url }) => {
          resetUrls.push(url);
        },
      },
    });

    auth = asBetterAuthInstance(rawAuth);
    authAdapter = new BetterAuthAdapter({ auth, logger: new NoopLogger() });
    userRepo = new DrizzleUserRepository({ db, logger: new NoopLogger() });
  });

  afterAll(async () => {
    if (sql) await sql.end();
    if (netlifyDB) await netlifyDB.stop();
  });

  beforeEach(async () => {
    resetUrls = [];
    await db.delete(betterAuthSessions);
    await db.delete(betterAuthAccounts);
    await db.delete(betterAuthVerifications);
    await db.delete(betterAuthUsers);
    await db.delete(platformUsers);
    await db.delete(identityLinkages);
  });

  function resetToken(): string {
    const url = new URL(resetUrls.at(-1) ?? "");
    return url.pathname.split("/").at(-1) ?? "";
  }

  it("registers a new user with password hashing", async () => {
    const result = await authAdapter.registerWithEmail({
      email: "test@example.com",
      password: "very-secure-password-123",
      displayName: "Test User",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sessionToken).toBeTruthy();
      expect(result.value.identity.email).toBe("test@example.com");
      expect(result.value.identity.emailVerified).toBe(false);
    }

    const baUsers = await db.select().from(betterAuthUsers);
    expect(baUsers.length).toBe(1);
    expect(baUsers[0]!.email).toBe("test@example.com");

    const accounts = await db.select().from(betterAuthAccounts);
    expect(accounts.length).toBe(1);
    expect(accounts[0]!.password).toBeTruthy();
    expect(accounts[0]!.password).not.toBe("very-secure-password-123");
  });

  it("rejects duplicate email registration", async () => {
    await authAdapter.registerWithEmail({
      email: "dup@example.com",
      password: "very-secure-password-123",
      displayName: "First",
    });

    const result = await authAdapter.registerWithEmail({
      email: "dup@example.com",
      password: "very-secure-password-123",
      displayName: "Second",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("duplicate_email");
    }
  });

  it("signs in with valid credentials and creates a session", async () => {
    await authAdapter.registerWithEmail({
      email: "signin@example.com",
      password: "very-secure-password-123",
      displayName: "Sign In",
    });

    const result = await authAdapter.signInWithEmail({
      email: "signin@example.com",
      password: "very-secure-password-123",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sessionToken).toBeTruthy();
      expect(result.value.identity.email).toBe("signin@example.com");
    }

    const sessions = await db.select().from(betterAuthSessions);
    expect(sessions.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects sign-in with invalid password", async () => {
    await authAdapter.registerWithEmail({
      email: "invalidpw@example.com",
      password: "very-secure-password-123",
      displayName: "Invalid Pw",
    });

    const result = await authAdapter.signInWithEmail({
      email: "invalidpw@example.com",
      password: "wrong-password-12345",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_credentials");
    }
  });

  it("looks up an active session by token", async () => {
    const regResult = await authAdapter.registerWithEmail({
      email: "session@example.com",
      password: "very-secure-password-123",
      displayName: "Session",
    });
    if (!regResult.ok) throw new Error("registration failed");

    const sessionResult = await authAdapter.getSession(regResult.value.sessionToken);

    expect(sessionResult.ok).toBe(true);
    if (sessionResult.ok) {
      expect(sessionResult.value.identity.email).toBe("session@example.com");
    }
  });

  it("returns session_not_found for unknown token", async () => {
    const result = await authAdapter.getSession("nonexistent-token");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("session_not_found");
    }
  });

  it("signs out and invalidates the session", async () => {
    const regResult = await authAdapter.registerWithEmail({
      email: "signout@example.com",
      password: "very-secure-password-123",
      displayName: "Sign Out",
    });
    if (!regResult.ok) throw new Error("registration failed");

    const token = regResult.value.sessionToken;
    const signOutResult = await authAdapter.signOut(token);
    expect(signOutResult.ok).toBe(true);

    const sessionResult = await authAdapter.getSession(token);
    expect(sessionResult.ok).toBe(false);
  });

  it("revokes a session", async () => {
    const regResult = await authAdapter.registerWithEmail({
      email: "revoke@example.com",
      password: "very-secure-password-123",
      displayName: "Revoke",
    });
    if (!regResult.ok) throw new Error("registration failed");

    const token = regResult.value.sessionToken;
    const revokeResult = await authAdapter.revokeSession(token);
    expect(revokeResult.ok).toBe(true);
  });

  it("creates a Platform User linked to the auth subject", async () => {
    const regResult = await authAdapter.registerWithEmail({
      email: "linkage@example.com",
      password: "very-secure-password-123",
      displayName: "Linkage",
    });
    if (!regResult.ok) throw new Error("registration failed");

    const authSubjectId = regResult.value.identity.authSubjectId;

    const draft = createUserDraft({
      id: "user_linkage_test" as UserId,
      authSubjectId: authSubjectId as AuthSubjectId,
      email: "linkage@example.com",
      displayName: "Linkage",
      now: "2026-01-01T00:00:00.000Z" as ISODateString,
    });

    const createResult = await userRepo.create(draft);
    expect(createResult.ok).toBe(true);
    if (createResult.ok) {
      expect(createResult.value.version).toBe(1);
      expect(createResult.value.authSubjectId).toBe(authSubjectId);
    }

    const found = await userRepo.findByAuthSubjectId(authSubjectId);
    expect(found).not.toBeNull();
    expect(found?.email).toBe("linkage@example.com");
  });

  it("does not enumerate unknown email addresses during reset requests", async () => {
    const known = await auth.api.requestPasswordReset({ body: { email: "missing@example.com", redirectTo: `${TEST_URL}/reset-password` } });
    expect(known.status).toBe(true);
    expect(known.message).toMatch(/If this email exists/i);
    expect(resetUrls).toHaveLength(0);
  });

  it("generates a reset token without logging it", async () => {
    await authAdapter.registerWithEmail({ email: "reset-token@example.com", password: "very-secure-password-123", displayName: "Reset Token" });
    const spies = ["log", "warn", "error", "debug"].map((method) =>
      vi.spyOn(console, method as "log").mockImplementation(() => {}),
    );
    await auth.api.requestPasswordReset({ body: { email: "reset-token@example.com", redirectTo: `${TEST_URL}/reset-password` } });
    const token = resetToken();
    expect(token).toBeTruthy();
    expect((await db.select().from(betterAuthVerifications)).some((item) => item.identifier === `reset-password:${token}`)).toBe(true);
    expect(spies.flatMap((spy) => spy.mock.calls).flat().join(" ")).not.toContain(token);
    spies.forEach((spy) => spy.mockRestore());
  });

  it("resets a password with a valid one-time token", async () => {
    await authAdapter.registerWithEmail({ email: "reset-valid@example.com", password: "old-secure-password-123", displayName: "Reset Valid" });
    await auth.api.requestPasswordReset({ body: { email: "reset-valid@example.com", redirectTo: `${TEST_URL}/reset-password` } });
    await auth.api.resetPassword({ body: { token: resetToken(), newPassword: "new-secure-password-456" } });
    expect((await authAdapter.signInWithEmail({ email: "reset-valid@example.com", password: "new-secure-password-456" })).ok).toBe(true);
    expect((await authAdapter.signInWithEmail({ email: "reset-valid@example.com", password: "old-secure-password-123" })).ok).toBe(false);
  });

  it("rejects expired reset tokens", async () => {
    await authAdapter.registerWithEmail({ email: "reset-expired@example.com", password: "old-secure-password-123", displayName: "Reset Expired" });
    await auth.api.requestPasswordReset({ body: { email: "reset-expired@example.com", redirectTo: `${TEST_URL}/reset-password` } });
    const token = resetToken();
    await db.update(betterAuthVerifications).set({ expires_at: new Date(0) }).where(eq(betterAuthVerifications.identifier, `reset-password:${token}`));
    await expect(auth.api.resetPassword({ body: { token, newPassword: "new-secure-password-456" } })).rejects.toThrow();
  });

  it("rejects reused reset tokens", async () => {
    await authAdapter.registerWithEmail({ email: "reset-reused@example.com", password: "old-secure-password-123", displayName: "Reset Reused" });
    await auth.api.requestPasswordReset({ body: { email: "reset-reused@example.com", redirectTo: `${TEST_URL}/reset-password` } });
    const token = resetToken();
    await auth.api.resetPassword({ body: { token, newPassword: "new-secure-password-456" } });
    await expect(auth.api.resetPassword({ body: { token, newPassword: "another-secure-password-789" } })).rejects.toThrow();
  });

  it("rejects weak reset passwords without consuming the token", async () => {
    await authAdapter.registerWithEmail({ email: "reset-weak@example.com", password: "old-secure-password-123", displayName: "Reset Weak" });
    await auth.api.requestPasswordReset({ body: { email: "reset-weak@example.com", redirectTo: `${TEST_URL}/reset-password` } });
    const token = resetToken();
    await expect(auth.api.resetPassword({ body: { token, newPassword: "short" } })).rejects.toThrow();
    await expect(auth.api.resetPassword({ body: { token, newPassword: "new-secure-password-456" } })).resolves.toEqual({ status: true });
  });

  it("changes a password after verifying the current password", async () => {
    const registered = await authAdapter.registerWithEmail({ email: "change-valid@example.com", password: "old-secure-password-123", displayName: "Change Valid" });
    if (!registered.ok) throw new Error("registration failed");
    await auth.api.changePassword({
      headers: new Headers({ cookie: registered.value.sessionToken }),
      body: { currentPassword: "old-secure-password-123", newPassword: "new-secure-password-456", revokeOtherSessions: false },
    });
    expect((await authAdapter.signInWithEmail({ email: "change-valid@example.com", password: "new-secure-password-456" })).ok).toBe(true);
  });

  it("rejects an incorrect current password", async () => {
    const registered = await authAdapter.registerWithEmail({ email: "change-invalid@example.com", password: "old-secure-password-123", displayName: "Change Invalid" });
    if (!registered.ok) throw new Error("registration failed");
    await expect(auth.api.changePassword({
      headers: new Headers({ cookie: registered.value.sessionToken }),
      body: { currentPassword: "wrong-secure-password-123", newPassword: "new-secure-password-456", revokeOtherSessions: false },
    })).rejects.toThrow();
  });

  it("revokes active sessions after a password reset", async () => {
    const registered = await authAdapter.registerWithEmail({ email: "reset-sessions@example.com", password: "old-secure-password-123", displayName: "Reset Sessions" });
    if (!registered.ok) throw new Error("registration failed");
    await auth.api.requestPasswordReset({ body: { email: "reset-sessions@example.com", redirectTo: `${TEST_URL}/reset-password` } });
    await auth.api.resetPassword({ body: { token: resetToken(), newPassword: "new-secure-password-456" } });
    expect((await authAdapter.getSession(registered.value.sessionToken)).ok).toBe(false);
  });
});
