import { isKnownPermission, } from "./permissions";
import { getPermissionsForRole, } from "./roles";
import { SystemRoles } from "@livingsites/domain";
export class AuthorizationService {
    membershipReader;
    superAdminChecker;
    constructor(config) {
        this.membershipReader = config.membershipReader;
        this.superAdminChecker = config.superAdminChecker;
    }
    async can(request) {
        if (!request.userId) {
            return {
                allowed: false,
                code: "unauthenticated",
                reason: "User identifier is required for authorization.",
            };
        }
        if (!isKnownPermission(request.permission)) {
            return {
                allowed: false,
                code: "unknown_permission",
                reason: `Unknown permission key: "${request.permission}".`,
            };
        }
        // 1. Check Platform Super Admin
        if (request.isPlatformSuperAdmin === true ||
            request.platformRole === SystemRoles.PLATFORM_SUPER_ADMIN ||
            request.platformRole === "PLATFORM_SUPER_ADMIN" ||
            (this.superAdminChecker && (await this.superAdminChecker.isSuperAdmin(request.userId)))) {
            return {
                allowed: true,
                reason: "Platform Super Admin granted platform-approved action.",
            };
        }
        // 2. Organization scope requirement
        if (!request.organizationId) {
            return {
                allowed: false,
                code: "invalid_context",
                reason: "Organization context is required for non-platform authorization checks.",
            };
        }
        // 3. Load active membership
        const membership = await this.membershipReader.findForUserAndOrganization(request.organizationId, request.userId);
        if (!membership || membership.status !== "active") {
            return {
                allowed: false,
                code: "no_active_membership",
                reason: "User has no active membership in the target organization.",
            };
        }
        // Validate organization match
        if (membership.organizationId !== request.organizationId) {
            return {
                allowed: false,
                code: "scope_mismatch",
                reason: "Membership belongs to a different organization.",
            };
        }
        // 4. Validate website scope if present
        if (membership.websiteScopeId) {
            if (!request.websiteId || membership.websiteScopeId !== request.websiteId) {
                return {
                    allowed: false,
                    code: "scope_mismatch",
                    reason: `Membership is restricted to website "${membership.websiteScopeId}".`,
                };
            }
        }
        // 5. Resolve role permissions
        const permissions = getPermissionsForRole(membership.role);
        if (!permissions.includes(request.permission)) {
            return {
                allowed: false,
                code: "permission_denied",
                reason: `Role "${membership.role}" does not grant permission "${request.permission}".`,
            };
        }
        return { allowed: true };
    }
    async resolvePermissions(organizationId, userId) {
        if (this.superAdminChecker && (await this.superAdminChecker.isSuperAdmin(userId))) {
            return getPermissionsForRole(SystemRoles.PLATFORM_SUPER_ADMIN);
        }
        const membership = await this.membershipReader.findForUserAndOrganization(organizationId, userId);
        if (!membership || membership.status !== "active") {
            return [];
        }
        return getPermissionsForRole(membership.role);
    }
}
//# sourceMappingURL=service.js.map