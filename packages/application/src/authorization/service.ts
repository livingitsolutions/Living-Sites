/**
 * Authorization service — server-side authorization capability.
 *
 * Evaluates permission requests based on:
 * 1. Platform Super Admin (platform-scoped)
 * 2. Active membership in target organization
 * 3. Website scope constraint (if membership is scoped to a specific website)
 * 4. Granted permissions from assigned system role
 */
import type {
  UserId,
  OrganizationId,
  WebsiteId,
} from "@livingsites/domain";
import type { MembershipReader } from "../repositories/membership";
import {
  type PermissionKey,
  isKnownPermission,
} from "./permissions";
import {
  getPermissionsForRole,
} from "./roles";
import { SystemRoles } from "@livingsites/domain";

export type AuthorizationDenialCode =
  | "unauthenticated"
  | "no_active_membership"
  | "scope_mismatch"
  | "permission_denied"
  | "unknown_permission"
  | "invalid_context";

export type AuthorizationDecision =
  | { readonly allowed: true; readonly reason?: string }
  | { readonly allowed: false; readonly code: AuthorizationDenialCode; readonly reason: string };

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

export class AuthorizationService {
  private readonly membershipReader: MembershipReader;
  private readonly superAdminChecker?: PlatformSuperAdminChecker;

  constructor(config: AuthorizationServiceConfig) {
    this.membershipReader = config.membershipReader;
    this.superAdminChecker = config.superAdminChecker;
  }

  async can(request: AuthorizationRequest): Promise<AuthorizationDecision> {
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
    if (this.superAdminChecker && (await this.superAdminChecker.isSuperAdmin(request.userId))) {
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
    const membership = await this.membershipReader.findForUserAndOrganization(
      request.organizationId,
      request.userId,
      request.websiteId ?? null,
    );

    if (!membership || membership.status !== "active") {
      const scopedMemberships = await this.membershipReader.listForUserAndOrganization(
        request.organizationId,
        request.userId,
      );
      if (scopedMemberships.length > 0) {
        return {
          allowed: false,
          code: "scope_mismatch",
          reason: "User has active memberships, but none match the requested website scope.",
        };
      }
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
    if (!permissions.includes(request.permission as PermissionKey)) {
      return {
        allowed: false,
        code: "permission_denied",
        reason: `Role "${membership.role}" does not grant permission "${request.permission}".`,
      };
    }

    return { allowed: true };
  }

  async resolvePermissions(
    organizationId: OrganizationId,
    userId: UserId,
    websiteId?: WebsiteId | null,
  ): Promise<readonly PermissionKey[]> {
    if (this.superAdminChecker && (await this.superAdminChecker.isSuperAdmin(userId))) {
      return getPermissionsForRole(SystemRoles.PLATFORM_SUPER_ADMIN);
    }
    const membership = await this.membershipReader.findForUserAndOrganization(organizationId, userId, websiteId ?? null);
    if (!membership || membership.status !== "active") {
      return [];
    }
    return getPermissionsForRole(membership.role);
  }
}
