/**
 * Authorization service — server-side authorization capability.
 *
 * Evaluates permission requests based on:
 * 1. Platform Super Admin (platform-scoped)
 * 2. Active membership in target organization
 * 3. Website scope constraint (if membership is scoped to a specific website)
 * 4. Granted permissions from assigned system role
 */
import type { UserId, OrganizationId, WebsiteId } from "@livingsites/domain";
import type { MembershipReader } from "../repositories/membership";
import { type PermissionKey } from "./permissions";
export type AuthorizationDenialCode = "unauthenticated" | "no_active_membership" | "scope_mismatch" | "permission_denied" | "unknown_permission" | "invalid_context";
export type AuthorizationDecision = {
    readonly allowed: true;
    readonly reason?: string;
} | {
    readonly allowed: false;
    readonly code: AuthorizationDenialCode;
    readonly reason: string;
};
export interface AuthorizationRequest {
    readonly userId: UserId;
    readonly permission: PermissionKey | string;
    readonly organizationId?: OrganizationId;
    readonly websiteId?: WebsiteId;
}
export interface PlatformSuperAdminChecker {
    isSuperAdmin(userId: UserId): Promise<boolean> | boolean;
}
export interface AuthorizationServiceConfig {
    readonly membershipReader: MembershipReader;
    readonly superAdminChecker?: PlatformSuperAdminChecker;
}
export declare class AuthorizationService {
    private readonly membershipReader;
    private readonly superAdminChecker?;
    constructor(config: AuthorizationServiceConfig);
    can(request: AuthorizationRequest): Promise<AuthorizationDecision>;
    resolvePermissions(organizationId: OrganizationId, userId: UserId, websiteId?: WebsiteId | null): Promise<readonly PermissionKey[]>;
}
//# sourceMappingURL=service.d.ts.map