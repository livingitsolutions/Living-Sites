/**
 * System roles and their explicit permission mappings.
 *
 * Rules:
 * - Super Admin is platform-scoped (has all approved permissions).
 * - Organization Owner is org-scoped (all org permissions).
 * - Admin is org-scoped (all org permissions, subject to sole-owner invariant).
 * - Editor may create/update content but must not manage organization ownership or billing.
 * - Viewer is read-only.
 * - Roles belong to memberships, never directly to User.
 * - No wildcard permissions.
 */
import { type PermissionKey } from "./permissions";
export declare const SYSTEM_ROLE_PERMISSIONS: Readonly<Record<string, readonly PermissionKey[]>>;
/**
 * Normalizes any recognized role string to canonical system role value.
 */
export declare function normalizeSystemRole(role: string): string | null;
export declare function getPermissionsForRole(role: string): readonly PermissionKey[];
//# sourceMappingURL=roles.d.ts.map