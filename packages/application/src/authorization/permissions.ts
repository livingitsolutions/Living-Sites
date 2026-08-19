/**
 * Explicit permission catalog grouped by resource.
 *
 * No wildcard "admin" permissions are permitted.
 * Every permission is an explicit dot-notated string key.
 */

export const OrganizationPermissions = {
  Read: "organization.read",
  Update: "organization.update",
  MembersRead: "organization.members.read",
  MembersInvite: "organization.members.invite",
  MembersUpdate: "organization.members.update",
  MembersRemove: "organization.members.remove",
} as const;

export const WebsitePermissions = {
  Read: "website.read",
  Create: "website.create",
  Update: "website.update",
  Publish: "website.publish",
} as const;

export const PagePermissions = {
  Read: "page.read",
  Create: "page.create",
  Update: "page.update",
  Publish: "page.publish",
  Archive: "page.archive",
} as const;

export const MediaPermissions = {
  Read: "media.read",
  Upload: "media.upload",
  Update: "media.update",
  Delete: "media.delete",
} as const;

export const FormPermissions = {
  Read: "form.read",
  Create: "form.create",
  Update: "form.update",
  SubmissionRead: "submission.read",
} as const;

export const SettingsPermissions = {
  Read: "settings.read",
  Update: "settings.update",
} as const;

export const Permissions = {
  Organization: OrganizationPermissions,
  Website: WebsitePermissions,
  Page: PagePermissions,
  Media: MediaPermissions,
  Form: FormPermissions,
  Settings: SettingsPermissions,
} as const;

export const ALL_PERMISSIONS: readonly string[] = [
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
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

export function isKnownPermission(permission: string): permission is PermissionKey {
  return (ALL_PERMISSIONS as readonly string[]).includes(permission);
}
