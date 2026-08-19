import {
  FormPermissions,
  MediaPermissions,
  OrganizationPermissions,
  PagePermissions,
  SettingsPermissions,
  WebsitePermissions,
  type PermissionKey,
} from "@livingsites/application";

export const adminNavigation = [
  { label: "Dashboard", segment: "", permission: OrganizationPermissions.Read },
  { label: "Websites", segment: "websites", permission: WebsitePermissions.Read },
  { label: "Web Builder", segment: "web-builder", permission: PagePermissions.Read },
  { label: "Media", segment: "media", permission: MediaPermissions.Read },
  { label: "Forms", segment: "forms", permission: FormPermissions.Read },
  { label: "SEO", segment: "seo", permission: SettingsPermissions.Read },
  { label: "Analytics", segment: "analytics", permission: OrganizationPermissions.Read },
  { label: "Settings", segment: "settings", permission: SettingsPermissions.Read },
] as const;

export function buildOrganizationNavigation(organizationId: string, permissions: Partial<Record<PermissionKey, boolean>>) {
  const base = `/admin/organizations/${organizationId}`;
  return adminNavigation
    .filter((item) => permissions[item.permission])
    .map((item) => ({ label: item.label, href: item.segment ? `${base}/${item.segment}` : base }));
}
