import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NetlifyDB } from "@netlify/database-dev";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { composeProduction, type ProductionComposition } from "@livingsites/composition";
import type { BetterAuthInstance } from "@livingsites/infrastructure";
import * as schema from "../../../packages/infrastructure/src/db/schema";
import { identityLinkages } from "../../../packages/infrastructure/src/db/identity-linkage-schema";
import { createAuthRequestHandler } from "./auth-request-handler";
import { evaluateAuthPageRequest } from "../../lib/auth-page-request";

const baseURL = "http://localhost:3000";
const password = "very-secure-password-123";

describe("/api/auth/[...all] requests", () => {
  let netlifyDB: NetlifyDB;
  let sqlClient: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let composition: ProductionComposition;
  let auth: BetterAuthInstance;
  let handle: ReturnType<typeof createAuthRequestHandler>;

  beforeAll(async () => {
    netlifyDB = new NetlifyDB({ logger: () => {} });
    const connectionString = await netlifyDB.start();
    await netlifyDB.applyMigrations("./netlify/database/migrations");
    sqlClient = postgres(connectionString);
    db = drizzle({ client: sqlClient, schema });
    composition = composeProduction({
      connectionString,
      betterAuthSecret: "request-test-secret-at-least-32-characters",
      betterAuthUrl: baseURL,
      trustedOrigins: [baseURL],
      registrationMode: "open",
      logLevel: "silent",
    });
    auth = composition.authInstance;
    handle = createAuthRequestHandler(() => auth, () => [baseURL]);
  });

  afterAll(async () => {
    if (sqlClient) await sqlClient.end();
    if (composition) await composition.close();
    if (netlifyDB) await netlifyDB.stop();
  });

  beforeEach(async () => {
    await db.delete(identityLinkages);
    await db.delete(schema.betterAuthSessions);
    await db.delete(schema.betterAuthAccounts);
    await db.delete(schema.betterAuthVerifications);
    await db.delete(schema.betterAuthUsers);
  });

  async function register(email: string) {
    await auth.api.signUpEmail({ body: { email, password, name: "Request User" }, returnHeaders: true });
  }

  async function authenticatedCookie(email: string): Promise<string> {
    await register(email);
    const response = await handle(new Request(`${baseURL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { origin: baseURL, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }));
    return (response.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "";
  }

  it("blocks direct Better Auth sign-up", async () => {
    const response = await handle(new Request(`${baseURL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { origin: baseURL, "content-type": "application/json" },
      body: JSON.stringify({ email: "blocked@example.com", password, name: "Blocked" }),
    }));
    expect(response.status).toBe(403);
    expect(await db.select().from(schema.betterAuthUsers)).toHaveLength(0);
  });

  it("rejects an untrusted origin", async () => {
    await register("origin@example.com");
    const response = await handle(new Request(`${baseURL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { origin: "https://untrusted.example", "content-type": "application/json" },
      body: JSON.stringify({ email: "origin@example.com", password }),
    }));
    expect(response.status).toBe(403);
  });

  it("accepts a trusted origin and sets a hardened session cookie", async () => {
    await register("cookie@example.com");
    const response = await handle(new Request(`${baseURL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { origin: baseURL, "content-type": "application/json" },
      body: JSON.stringify({ email: "cookie@example.com", password }),
    }));
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(response.status).toBe(200);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("redirects browser sign-in forms to admin while preserving the session cookie", async () => {
    await register("browser-login@example.com");
    const response = await handle(new Request(`${baseURL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { origin: baseURL, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: "browser-login@example.com", password }),
    }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/admin");
    expect(response.headers.get("set-cookie")).toContain("better-auth.session_token");
  });

  it("returns authenticated and unauthenticated session states", async () => {
    const anonymous = await handle(new Request(`${baseURL}/api/auth/get-session`));
    expect(await anonymous.json()).toBeNull();

    await register("session@example.com");
    const signIn = await handle(new Request(`${baseURL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { origin: baseURL, "content-type": "application/json" },
      body: JSON.stringify({ email: "session@example.com", password }),
    }));
    const cookie = (signIn.headers.get("set-cookie") ?? "").split(";")[0];
    const authenticated = await handle(new Request(`${baseURL}/api/auth/get-session`, { headers: { cookie } }));
    const body = await authenticated.json() as { user: { email: string } };
    expect(body.user.email).toBe("session@example.com");
  });

  it("sign-out invalidates the session", async () => {
    await register("signout-request@example.com");
    const signIn = await handle(new Request(`${baseURL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { origin: baseURL, "content-type": "application/json" },
      body: JSON.stringify({ email: "signout-request@example.com", password }),
    }));
    const cookie = (signIn.headers.get("set-cookie") ?? "").split(";")[0];
    const signOut = await handle(new Request(`${baseURL}/api/auth/sign-out`, {
      method: "POST",
      headers: { origin: baseURL, cookie },
    }));
    expect(signOut.status).toBe(200);
    const session = await handle(new Request(`${baseURL}/api/auth/get-session`, { headers: { cookie } }));
    expect(await session.json()).toBeNull();
  });

  it("redirects browser sign-out forms to login and clears the session cookie", async () => {
    const cookie = await authenticatedCookie("browser-logout@example.com");
    const response = await handle(new Request(`${baseURL}/api/auth/sign-out`, {
      method: "POST",
      headers: {
        origin: baseURL,
        cookie,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(),
    }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/login");
  });

  it("prevents a disabled orphan identity from authenticating", async () => {
    await register("disabled-orphan@example.com");
    await db
      .update(schema.betterAuthUsers)
      .set({ disabled: true, disabled_at: new Date() })
      .where(eq(schema.betterAuthUsers.email, "disabled-orphan@example.com"));
    await db.delete(schema.betterAuthSessions);

    const response = await handle(new Request(`${baseURL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { origin: baseURL, "content-type": "application/json" },
      body: JSON.stringify({ email: "disabled-orphan@example.com", password }),
    }));
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await db.select().from(schema.betterAuthSessions)).toHaveLength(0);
  });

  it("handles unauthenticated /login and authenticated /login", async () => {
    expect(await evaluateAuthPageRequest(new Request(`${baseURL}/login`), auth)).toMatchObject({ kind: "render" });
    const cookie = await authenticatedCookie("login-page@example.com");
    expect(await evaluateAuthPageRequest(new Request(`${baseURL}/login`, { headers: { cookie } }), auth))
      .toEqual({ kind: "redirect", location: "/admin" });
  });

  it("enforces registration modes for /register", async () => {
    const request = new Request(`${baseURL}/register`);
    expect(await evaluateAuthPageRequest(request, auth, "open")).toMatchObject({ kind: "render", registrationMode: "open" });
    expect(await evaluateAuthPageRequest(request, auth, "invite_only")).toMatchObject({ kind: "render", registrationMode: "invite_only" });
    expect(await evaluateAuthPageRequest(request, auth, "disabled")).toMatchObject({ kind: "render", registrationMode: "disabled" });
  });

  it("protects /admin and admits an authenticated session", async () => {
    expect(await evaluateAuthPageRequest(new Request(`${baseURL}/admin`), auth))
      .toEqual({ kind: "redirect", location: "/login" });
    const cookie = await authenticatedCookie("admin-page@example.com");
    const decision = await evaluateAuthPageRequest(new Request(`${baseURL}/admin`, { headers: { cookie } }), auth);
    expect(decision.kind).toBe("render");
    if (decision.kind === "render") expect(decision.session?.user.email).toBe("admin-page@example.com");
  });
});
