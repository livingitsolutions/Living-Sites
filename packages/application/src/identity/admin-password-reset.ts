export interface AdminPasswordResetLinkDeps {
  isPlatformSuperAdmin(email: string): Promise<boolean>;
  requestPasswordReset(email: string): Promise<void>;
  readCapturedResetUrl(): string | undefined;
}

export async function generateAdminPasswordResetLink(
  email: string,
  deps: AdminPasswordResetLinkDeps,
): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !await deps.isPlatformSuperAdmin(normalizedEmail)) {
    throw new Error("The requested account is not the active Platform Super Admin.");
  }

  await deps.requestPasswordReset(normalizedEmail);
  const resetUrl = deps.readCapturedResetUrl();
  if (!resetUrl) throw new Error("Better Auth did not generate a reset link for this account.");
  return resetUrl;
}
