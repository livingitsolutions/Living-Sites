"use server";
import { headers } from "next/headers";
import { getAuth } from "@/app/lib/auth";
import {
  changePasswordForSession,
  requestPasswordResetSafely,
  resetPasswordWithToken,
  type PasswordFormState,
} from "@/app/lib/password-workflows";

export async function forgotPasswordAction(
  _previousState: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return requestPasswordResetSafely(getAuth(), String(formData.get("email") ?? ""), baseUrl);
}

export async function resetPasswordAction(
  _previousState: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  return resetPasswordWithToken(getAuth(), {
    token: String(formData.get("token") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
}

export async function changePasswordAction(
  _previousState: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  return changePasswordForSession(getAuth(), await headers(), {
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    revokeOtherSessions: formData.get("revokeOtherSessions") === "on",
  });
}
