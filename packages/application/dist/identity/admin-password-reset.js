export async function generateAdminPasswordResetLink(email, deps) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !await deps.isPlatformSuperAdmin(normalizedEmail)) {
        throw new Error("The requested account is not the active Platform Super Admin.");
    }
    await deps.requestPasswordReset(normalizedEmail);
    const resetUrl = deps.readCapturedResetUrl();
    if (!resetUrl)
        throw new Error("Better Auth did not generate a reset link for this account.");
    return resetUrl;
}
//# sourceMappingURL=admin-password-reset.js.map