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
};
export const WebsitePermissions = {
    Read: "website.read",
    Create: "website.create",
    Update: "website.update",
    Publish: "website.publish",
};
export const PagePermissions = {
    Read: "page.read",
    Create: "page.create",
    Update: "page.update",
    Publish: "page.publish",
    Archive: "page.archive",
};
export const MediaPermissions = {
    Read: "media.read",
    Upload: "media.upload",
    Update: "media.update",
    Delete: "media.delete",
};
export const FormPermissions = {
    Read: "form.read",
    Create: "form.create",
    Update: "form.update",
    SubmissionRead: "submission.read",
};
export const SettingsPermissions = {
    Read: "settings.read",
    Update: "settings.update",
};
export const Permissions = {
    Organization: OrganizationPermissions,
    Website: WebsitePermissions,
    Page: PagePermissions,
    Media: MediaPermissions,
    Form: FormPermissions,
    Settings: SettingsPermissions,
};
export const ALL_PERMISSIONS = [
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
];
export function isKnownPermission(permission) {
    return ALL_PERMISSIONS.includes(permission);
}
//# sourceMappingURL=permissions.js.map