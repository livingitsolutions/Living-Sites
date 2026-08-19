import { describe, expect, it, vi } from "vitest";
import type { Context } from "@netlify/functions";
// @ts-expect-error Vitest resolves the Netlify Function's .mts module directly.
import { createAdminBootstrapHandler } from "../functions/admin-bootstrap-reconcile.mts";

const token = "a-strong-one-time-bootstrap-token-value";

describe("admin-bootstrap-reconcile Function", () => {
  it("rejects an unauthorized request without running reconciliation", async () => {
    const reconcile = vi.fn();
    const handler = createAdminBootstrapHandler({
      getEnvironment: () => token,
      reconcile,
    });

    const response = await handler(new Request("https://example.netlify.app/.netlify/functions/admin-bootstrap-reconcile", {
      method: "POST",
      headers: { authorization: "Bearer wrong-token" },
      body: JSON.stringify({ email: "livingitsolutions@gmail.com" }),
    }), { deploy: { context: "production" } } as Context);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "unauthorized" });
    expect(reconcile).not.toHaveBeenCalled();
  });
});
