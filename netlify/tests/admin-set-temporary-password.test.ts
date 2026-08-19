import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canonicalPasswordCapabilities,
  createAdminSetTemporaryPasswordHandler,
  type PasswordCapabilities,
  type PasswordChangeStore,
  type PasswordChangeTransaction,
} from "../functions/admin-set-temporary-password.mjs";

const targetEmail = "livingitsolutions@gmail.com";
const operatorToken = "operator-token-with-at-least-thirty-two-characters";
const temporaryPassword = "runtime-only-temporary-password";

interface StoreHarness {
  readonly store: PasswordChangeStore;
  readonly findVerifiedTarget: ReturnType<typeof vi.fn<PasswordChangeTransaction["findVerifiedTarget"]>>;
  readonly updateCredential: ReturnType<typeof vi.fn<PasswordChangeTransaction["updateCredential"]>>;
  readonly readCredentialHash: ReturnType<typeof vi.fn<PasswordChangeTransaction["readCredentialHash"]>>;
  readonly revokeSessions: ReturnType<typeof vi.fn<PasswordChangeTransaction["revokeSessions"]>>;
  readonly countSessions: ReturnType<typeof vi.fn<PasswordChangeTransaction["countSessions"]>>;
}

function createStoreHarness(options: {
  readonly verified?: boolean;
  readonly passwordCapabilities?: PasswordCapabilities;
} = {}): StoreHarness {
  const target = { authSubjectId: "auth_admin", credentialId: "credential_admin" };
  let storedHash: string | null = null;
  let sessions = 3;
  const findVerifiedTarget = vi.fn<PasswordChangeTransaction["findVerifiedTarget"]>()
    .mockResolvedValue(options.verified === false ? null : target);
  const updateCredential = vi.fn<PasswordChangeTransaction["updateCredential"]>()
    .mockImplementation(async (_target, passwordHash) => {
      storedHash = passwordHash;
      return true;
    });
  const readCredentialHash = vi.fn<PasswordChangeTransaction["readCredentialHash"]>()
    .mockImplementation(async () => storedHash);
  const revokeSessions = vi.fn<PasswordChangeTransaction["revokeSessions"]>()
    .mockImplementation(async () => {
      sessions = 0;
    });
  const countSessions = vi.fn<PasswordChangeTransaction["countSessions"]>()
    .mockImplementation(async () => sessions);

  return {
    store: {
      async transaction<T>(operation: (transaction: PasswordChangeTransaction) => Promise<T>): Promise<T> {
        return operation({
          findVerifiedTarget,
          updateCredential,
          readCredentialHash,
          revokeSessions,
          countSessions,
        });
      },
    },
    findVerifiedTarget,
    updateCredential,
    readCredentialHash,
    revokeSessions,
    countSessions,
  };
}

function createHandler(options: {
  readonly storeHarness?: StoreHarness;
  readonly passwordCapabilities?: PasswordCapabilities;
  readonly token?: string;
} = {}) {
  const storeHarness = options.storeHarness ?? createStoreHarness();
  const close = vi.fn(async () => undefined);
  const createRuntimeResources = vi.fn(() => ({ store: storeHarness.store, close }));
  const handler = createAdminSetTemporaryPasswordHandler({
    environment: { ADMIN_PASSWORD_CHANGE_TOKEN: options.token ?? operatorToken },
    passwordCapabilities: options.passwordCapabilities ?? {
      hash: vi.fn(async () => "canonical-hash"),
      verify: vi.fn(async ({ hash }) => hash === "canonical-hash"),
    },
    createRuntimeResources,
  });
  return { handler, storeHarness, close, createRuntimeResources };
}

function request(body: unknown, token = operatorToken): Request {
  return new Request("https://living-cms.netlify.app/.netlify/functions/admin-set-temporary-password", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("admin-set-temporary-password", () => {
  it("rejects GET requests", async () => {
    const { handler, createRuntimeResources } = createHandler();

    const response = await handler(new Request("https://example.com", { method: "GET" }));

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ ok: false });
    expect(createRuntimeResources).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["wrong", "incorrect-operator-token-with-thirty-two-characters"],
  ])("rejects a %s bearer token", async (_label, token) => {
    const { handler, createRuntimeResources } = createHandler();
    const headers = token ? { authorization: `Bearer ${token}` } : undefined;

    const response = await handler(new Request("https://example.com", {
      method: "POST",
      headers,
      body: JSON.stringify({ email: targetEmail, temporaryPassword }),
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false });
    expect(createRuntimeResources).not.toHaveBeenCalled();
  });

  it("rejects an operator token configured below 32 characters", async () => {
    const { handler, createRuntimeResources } = createHandler({ token: "too-short" });

    const response = await handler(request({ email: targetEmail, temporaryPassword }, "too-short"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false });
    expect(createRuntimeResources).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid JSON", "{"],
    ["missing email", JSON.stringify({ temporaryPassword })],
    ["missing password", JSON.stringify({ email: targetEmail })],
    ["empty password", JSON.stringify({ email: targetEmail, temporaryPassword: "" })],
  ])("rejects malformed input: %s", async (_label, body) => {
    const { handler, createRuntimeResources } = createHandler();
    const response = await handler(new Request("https://example.com", {
      method: "POST",
      headers: {
        authorization: `Bearer ${operatorToken}`,
        "content-type": "application/json",
      },
      body,
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false });
    expect(createRuntimeResources).not.toHaveBeenCalled();
  });

  it("rejects any email other than the designated account", async () => {
    const { handler, createRuntimeResources } = createHandler();

    const response = await handler(request({
      email: "another-admin@example.com",
      temporaryPassword,
    }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false });
    expect(createRuntimeResources).not.toHaveBeenCalled();
  });

  it("rejects the target email when it is not the active singleton Platform Super Admin", async () => {
    const storeHarness = createStoreHarness({ verified: false });
    const { handler, close } = createHandler({ storeHarness });

    const response = await handler(request({ email: targetEmail, temporaryPassword }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false });
    expect(storeHarness.updateCredential).not.toHaveBeenCalled();
    expect(storeHarness.revokeSessions).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it("uses Better Auth hashing, verifies the stored hash, and revokes sessions", async () => {
    const storeHarness = createStoreHarness();
    const { handler, close } = createHandler({
      storeHarness,
      passwordCapabilities: canonicalPasswordCapabilities,
    });

    const response = await handler(request({ email: targetEmail, temporaryPassword }));
    const body = await response.json();
    const storedHash = storeHarness.updateCredential.mock.calls[0]?.[1];

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      targetAccountVerified: true,
      platformSuperAdminVerified: true,
      credentialUpdated: true,
      passwordVerified: true,
      sessionsRevoked: true,
      removePasswordChangeToken: true,
    });
    expect(storedHash).toBeTypeOf("string");
    expect(storedHash).not.toBe(temporaryPassword);
    expect(await canonicalPasswordCapabilities.verify({
      hash: storedHash as string,
      password: temporaryPassword,
    })).toBe(true);
    expect(storeHarness.findVerifiedTarget).toHaveBeenCalledWith(targetEmail);
    expect(storeHarness.readCredentialHash).toHaveBeenCalledOnce();
    expect(storeHarness.revokeSessions).toHaveBeenCalledWith("auth_admin");
    expect(storeHarness.countSessions).toHaveBeenCalledWith("auth_admin");
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not expose the password through logs or responses", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { handler } = createHandler();

    const response = await handler(request({ email: targetEmail, temporaryPassword }));
    const responseText = await response.text();

    expect(responseText).not.toContain(temporaryPassword);
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
