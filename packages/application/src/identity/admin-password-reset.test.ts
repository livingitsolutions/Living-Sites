import { describe, expect, it, vi } from "vitest";
import { generateAdminPasswordResetLink } from "./admin-password-reset.js";

describe("generateAdminPasswordResetLink", () => {
  it("returns the captured one-time link for the active platform admin", async () => {
    const requestPasswordReset = vi.fn().mockResolvedValue(undefined);
    const link = await generateAdminPasswordResetLink("ADMIN@example.com", {
      isPlatformSuperAdmin: vi.fn().mockResolvedValue(true),
      requestPasswordReset,
      readCapturedResetUrl: () => "https://example.com/api/auth/reset-password/one-time-token?callbackURL=%2Freset-password",
    });
    expect(link).toContain("/reset-password/one-time-token");
    expect(requestPasswordReset).toHaveBeenCalledWith("admin@example.com");
  });

  it("refuses non-admin accounts before generating a token", async () => {
    const requestPasswordReset = vi.fn();
    await expect(generateAdminPasswordResetLink("user@example.com", {
      isPlatformSuperAdmin: vi.fn().mockResolvedValue(false),
      requestPasswordReset,
      readCapturedResetUrl: () => undefined,
    })).rejects.toThrow("not the active Platform Super Admin");
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });
});
