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
import {
  OrganizationPermissions,
  WebsitePermissions,
  PagePermissions,
  MediaPermissions,
  FormPermissions,
  SettingsPermissions,
  ALL_PERMISSIONS,
  type PermissionKey,
} from "./permissions";
import { SystemRoles } from "@livingsites/domain";

export const SYSTEM_ROLE_PERMISSIONS: Readonly<Record<string, readonly PermissionKey[]>> = {
  [SystemRoles.PLATFORM_SUPER_ADMIN]: [...ALL_PERMISSIONS],
  [SystemRoles.ORGANIZATION_OWNER]: [
    OrganizationPermissions.Read,
    OrganizationPermissions.Update,
    OrganizationPermissions.MembersRead,
    OrganizationPermissions.MembersInvite,
    OrganizationPermissions.MembersUpdate,
    OrganizationPermissions.MembersRemove,
    WebsitePermissions.Read,
    WebsitePermissions.Create,
    WebsitePermissions.Update,
    WebsitePermissions.Publish,
    PagePermissions.Read,
    PagePermissions.Create,
    PagePermissions.Update,
    PagePermissions.Publish,
    PagePermissions.Archive,
    MediaPermissions.Read,
    MediaPermissions.Upload,
    MediaPermissions.Update,
    MediaPermissions.Delete,
    FormPermissions.Read,
    FormPermissions.Create,
    FormPermissions.Update,
    FormPermissions.SubmissionRead,
    SettingsPermissions.Read,
    SettingsPermissions.Update,
  ],
  [SystemRoles.ORGANIZATION_ADMIN]: [
    OrganizationPermissions.Read,
    OrganizationPermissions.Update,
    OrganizationPermissions.MembersRead,
    OrganizationPermissions.MembersInvite,
    OrganizationPermissions.MembersUpdate,
    OrganizationPermissions.MembersRemove,
    WebsitePermissions.Read,
    WebsitePermissions.Create,
    WebsitePermissions.Update,
    WebsitePermissions.Publish,
    PagePermissions.Read,
    PagePermissions.Create,
    PagePermissions.Update,
    PagePermissions.Publish,
    PagePermissions.Archive,
    MediaPermissions.Read,
    MediaPermissions.Upload,
    MediaPermissions.Update,
    MediaPermissions.Delete,
    FormPermissions.Read,
    FormPermissions.Create,
    FormPermissions.Update,
    FormPermissions.SubmissionRead,
    SettingsPermissions.Read,
    SettingsPermissions.Update,
  ],
  [SystemRoles.EDITOR]: [
    OrganizationPermissions.Read,
    WebsitePermissions.Read,
    WebsitePermissions.Create,
    WebsitePermissions.Update,
    WebsitePermissions.Publish,
    PagePermissions.Read,
    PagePermissions.Create,
    PagePermissions.Update,
    PagePermissions.Publish,
    PagePermissions.Archive,
    MediaPermissions.Read,
    MediaPermissions.Upload,
    MediaPermissions.Update,
    MediaPermissions.Delete,
    FormPermissions.Read,
    FormPermissions.Create,
    FormPermissions.Update,
    FormPermissions.SubmissionRead,
    SettingsPermissions.Read,
  ],
  [SystemRoles.VIEWER]: [
    OrganizationPermissions.Read,
    OrganizationPermissions.MembersRead,
    WebsitePermissions.Read,
    PagePermissions.Read,
    MediaPermissions.Read,
    FormPermissions.Read,
    FormPermissions.SubmissionRead,
    SettingsPermissions.Read,
  ],
};

/**
 * Normalizes any recognized role string to canonical system role value.
 */
export function normalizeSystemRole(role: string): string | null {
  const normalized = role.trim().toLowerCase();
  if (normalized === "platform_super_admin" || normalized === "super_admin") {
    return SystemRoles.PLATFORM_SUPER_ADMIN;
  }
  if (normalized === "owner" || normalized === "organization_owner") {
    return SystemRoles.ORGANIZATION_OWNER;
  }
  if (normalized === "admin" || normalized === "organization_admin") {
    return SystemRoles.ORGANIZATION_ADMIN;
  }
  if (normalized === "editor") {
    return SystemRoles.EDITOR;
  }
  if (normalized === "viewer" || normalized === "author") {
    return normalized === "author" ? SystemRoles.EDITOR : SystemRoles.VIEWER;
  }
  return null;
}

export function normalizeOrganizationRole(role: string): string | null {
  const normalized = normalizeSystemRole(role);
  return normalized === SystemRoles.PLATFORM_SUPER_ADMIN ? null : normalized;
}

export function getPermissionsForRole(role: string): readonly PermissionKey[] {
  const normalized = normalizeSystemRole(role);
  if (!normalized) return [];
  return SYSTEM_ROLE_PERMISSIONS[normalized] ?? [];
}
