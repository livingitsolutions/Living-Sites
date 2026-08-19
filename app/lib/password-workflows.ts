import type { BetterAuthInstance } from "@livingsites/infrastructure";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;
export const PASSWORD_RESET_GENERIC_MESSAGE =
  "If an account matches that email, password reset instructions are now available through the configured recovery channel.";

export type PasswordFormState = {
  readonly status: "idle" | "success" | "error";
  readonly message?: string;
};

export const initialPasswordFormState: PasswordFormState = { status: "idle" };

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function passwordPolicyMessage(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Use no more than ${PASSWORD_MAX_LENGTH} characters.`;
  return null;
}

function authErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const candidate = error as { code?: unknown; body?: { code?: unknown } };
  if (typeof candidate.code === "string") return candidate.code;
  return typeof candidate.body?.code === "string" ? candidate.body.code : "";
}

export async function requestPasswordResetSafely(
  auth: BetterAuthInstance,
  email: string,
  baseUrl: string,
): Promise<PasswordFormState> {
  try {
    if (validEmail(email)) {
      await auth.api.requestPasswordReset({
        body: {
          email: email.trim().toLowerCase(),
          redirectTo: new URL("/reset-password", baseUrl).toString(),
        },
      });
    }
  } catch {
    // Deliberately return the same response for every outcome.
  }

  return { status: "success", message: PASSWORD_RESET_GENERIC_MESSAGE };
}

export async function resetPasswordWithToken(
  auth: BetterAuthInstance,
  input: { token: string; newPassword: string; confirmPassword: string },
): Promise<PasswordFormState> {
  if (!input.token) return { status: "error", message: "This reset link is invalid or has expired." };
  if (input.newPassword !== input.confirmPassword) {
    return { status: "error", message: "The new password and confirmation do not match." };
  }
  const policyError = passwordPolicyMessage(input.newPassword);
  if (policyError) return { status: "error", message: policyError };

  try {
    await auth.api.resetPassword({ body: { token: input.token, newPassword: input.newPassword } });
    return { status: "success", message: "Password reset complete. Sign in with your new password." };
  } catch {
    return { status: "error", message: "This reset link is invalid or has expired." };
  }
}

export async function changePasswordForSession(
  auth: BetterAuthInstance,
  requestHeaders: Headers,
  input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    revokeOtherSessions: boolean;
  },
): Promise<PasswordFormState> {
  if (!input.currentPassword) return { status: "error", message: "Enter your current password." };
  if (input.newPassword !== input.confirmPassword) {
    return { status: "error", message: "The new password and confirmation do not match." };
  }
  if (input.currentPassword === input.newPassword) {
    return { status: "error", message: "Choose a password different from your current password." };
  }
  const policyError = passwordPolicyMessage(input.newPassword);
  if (policyError) return { status: "error", message: policyError };

  try {
    await auth.api.changePassword({
      headers: requestHeaders,
      body: {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        revokeOtherSessions: input.revokeOtherSessions,
      },
    });
    return {
      status: "success",
      message: input.revokeOtherSessions
        ? "Password changed. Other sessions were revoked; this session remains active."
        : "Password changed. Existing sessions remain active.",
    };
  } catch (error) {
    return {
      status: "error",
      message: authErrorCode(error) === "INVALID_PASSWORD"
        ? "The current password is incorrect."
        : "The password could not be changed. Check your current password and try again.",
    };
  }
}
