/**
 * Users bounded context — identity and organization membership.
 *
 * A User is a platform-level identity. A Membership binds a User to a single
 * Organization with a Role. A User may hold memberships in many Organizations.
 */
import type {
  UserId,
  AuthSubjectId,
  MembershipId,
  OrganizationId,
  ISODateString,
  AuditTrail,
  LifecycleStatus,
  AggregateVersion,
} from "../shared/index.js";

/** Platform-level user identity. Not scoped to any single organization. */
export interface User {
  readonly id: UserId;
  /**
   * Opaque reference to the authentication-provider subject that owns this
   * platform identity. Unique across all Platform Users. The Domain never
   * imports the auth provider — it only stores this linkage.
   */
  authSubjectId: AuthSubjectId;
  /** Unique login email, lowercased. */
  email: string;
  /** Display name shown in UI. */
  displayName: string;
  /** Avatar media reference (optional, points to Media in some org's library). */
  avatarMediaId?: string;
  status: LifecycleStatus;
  /** Timestamp of last successful authentication. */
  lastSeenAt?: ISODateString;
  /** Optimistic concurrency version. Monotonically incremented on each save. */
  version: AggregateVersion;
  readonly audit: AuditTrail;
}

/**
 * Bindng of a User to an Organization with a granted Role.
 * A User's effective permissions within an Organization come from their
 * Memberships — never from a global role field on User.
 */
export interface Membership {
  readonly id: MembershipId;
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  role: RoleValue;
  /** Optional scope to a single website within the org; null = org-wide. */
  websiteScopeId?: string | null;
  status: LifecycleStatus;
  /** Optimistic concurrency version. Monotonically incremented on each save. */
  version: AggregateVersion;
  readonly audit: AuditTrail;
}

/**
 * A named bundle of permissions. Roles are platform-defined (Owner, Admin,
 * Editor, Author, Viewer) or organization-defined custom roles in the future.
 */
export interface Role {
  readonly key: MachineKeyRole;
  name: string;
  description?: string;
  /** Ordered permission keys granted by this role. */
  permissions: readonly string[];
  isSystem: boolean;
  /** Optimistic concurrency version. Monotonically incremented on each save. */
  version: AggregateVersion;
}

import type { MachineKey } from "../shared/index.js";
type MachineKeyRole = MachineKey;

export enum SystemRole {
  PlatformSuperAdmin = "platform_super_admin",
  Owner = "owner",
  Admin = "admin",
  Editor = "editor",
  Author = "author",
  Viewer = "viewer",
}

export const SystemRoles = {
  PLATFORM_SUPER_ADMIN: "platform_super_admin",
  ORGANIZATION_OWNER: "owner",
  ORGANIZATION_ADMIN: "admin",
  EDITOR: "editor",
  VIEWER: "viewer",
} as const;

export type SystemRoleKey = keyof typeof SystemRoles;
export type RoleValue = `${SystemRole}` | (typeof SystemRoles)[keyof typeof SystemRoles] | "organization_owner" | "organization_admin";
