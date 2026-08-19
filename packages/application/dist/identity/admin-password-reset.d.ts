export interface AdminPasswordResetLinkDeps {
    isPlatformSuperAdmin(email: string): Promise<boolean>;
    requestPasswordReset(email: string): Promise<void>;
    readCapturedResetUrl(): string | undefined;
}
export declare function generateAdminPasswordResetLink(email: string, deps: AdminPasswordResetLinkDeps): Promise<string>;
//# sourceMappingURL=admin-password-reset.d.ts.map