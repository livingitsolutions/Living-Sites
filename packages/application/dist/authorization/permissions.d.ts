/**
 * Explicit permission catalog grouped by resource.
 *
 * No wildcard "admin" permissions are permitted.
 * Every permission is an explicit dot-notated string key.
 */
export declare const OrganizationPermissions: {
    readonly Read: "organization.read";
    readonly Update: "organization.update";
    readonly MembersRead: "organization.members.read";
    readonly MembersInvite: "organization.members.invite";
    readonly MembersUpdate: "organization.members.update";
    readonly MembersRemove: "organization.members.remove";
};
export declare const WebsitePermissions: {
    readonly Read: "website.read";
    readonly Create: "website.create";
    readonly Update: "website.update";
    readonly Publish: "website.publish";
};
export declare const PagePermissions: {
    readonly Read: "page.read";
    readonly Create: "page.create";
    readonly Update: "page.update";
    readonly Publish: "page.publish";
    readonly Archive: "page.archive";
};
export declare const MediaPermissions: {
    readonly Read: "media.read";
    readonly Upload: "media.upload";
    readonly Update: "media.update";
    readonly Delete: "media.delete";
};
export declare const FormPermissions: {
    readonly Read: "form.read";
    readonly Create: "form.create";
    readonly Update: "form.update";
    readonly SubmissionRead: "submission.read";
};
export declare const SettingsPermissions: {
    readonly Read: "settings.read";
    readonly Update: "settings.update";
};
export declare const Permissions: {
    readonly Organization: {
        readonly Read: "organization.read";
        readonly Update: "organization.update";
        readonly MembersRead: "organization.members.read";
        readonly MembersInvite: "organization.members.invite";
        readonly MembersUpdate: "organization.members.update";
        readonly MembersRemove: "organization.members.remove";
    };
    readonly Website: {
        readonly Read: "website.read";
        readonly Create: "website.create";
        readonly Update: "website.update";
        readonly Publish: "website.publish";
    };
    readonly Page: {
        readonly Read: "page.read";
        readonly Create: "page.create";
        readonly Update: "page.update";
        readonly Publish: "page.publish";
        readonly Archive: "page.archive";
    };
    readonly Media: {
        readonly Read: "media.read";
        readonly Upload: "media.upload";
        readonly Update: "media.update";
        readonly Delete: "media.delete";
    };
    readonly Form: {
        readonly Read: "form.read";
        readonly Create: "form.create";
        readonly Update: "form.update";
        readonly SubmissionRead: "submission.read";
    };
    readonly Settings: {
        readonly Read: "settings.read";
        readonly Update: "settings.update";
    };
};
export declare const ALL_PERMISSIONS: readonly string[];
export type PermissionKey = (typeof ALL_PERMISSIONS)[number];
export declare function isKnownPermission(permission: string): permission is PermissionKey;
//# sourceMappingURL=permissions.d.ts.map