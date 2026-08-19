import { describe, expect, it, vi } from "vitest";
import type { BetterAuthInstance } from "@livingsites/infrastructure";
import {
  PASSWORD_RESET_GENERIC_MESSAGE,
  changePasswordForSession,
  requestPasswordResetSafely,
  resetPasswordWithToken,
} from "./password-workflows";
import { loginRegistrationContent } from "./login-registration";

function authWith(api: Partial<BetterAuthInstance["api"]>): BetterAuthInstance {
  return { handler: vi.fn(), api } as unknown as BetterAuthInstance;
}

describe("password form boundaries", () => {
  it("returns the same generic response for known and unknown email outcomes", async () => {
    const known = authWith({ requestPasswordReset: vi.fn().mockResolvedValue({ status: true, message: "ok" }) });
    const unknown = authWith({ requestPasswordReset: vi.fn().mockRejectedValue(new Error("user not found")) });
    const knownResult = await requestPasswordResetSafely(known, "known@example.com", "https://example.com");
    const unknownResult = await requestPasswordResetSafely(unknown, "unknown@example.com", "https://example.com");
    expect(knownResult).toEqual(unknownResult);
    expect(knownResult.message).toBe(PASSWORD_RESET_GENERIC_MESSAGE);
  });

  it("rejects weak reset passwords before calling Better Auth", async () => {
    const resetPassword = vi.fn();
    const result = await resetPasswordWithToken(authWith({ resetPassword }), {
      token: "token",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result.status).toBe("error");
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("maps incorrect current passwords without exposing provider errors", async () => {
    const error = Object.assign(new Error("database detail"), { code: "INVALID_PASSWORD" });
    const result = await changePasswordForSession(
      authWith({ changePassword: vi.fn().mockRejectedValue(error) }),
      new Headers(),
      { currentPassword: "old-password-123", newPassword: "new-password-456", confirmPassword: "new-password-456", revokeOtherSessions: true },
    );
    expect(result).toEqual({ status: "error", message: "The current password is incorrect." });
  });

  it("hides the Register link when registration is disabled", () => {
    expect(loginRegistrationContent("disabled")).toEqual({
      kind: "message",
      text: "Registration is currently disabled. Contact your platform administrator for access.",
    });
  });
});
