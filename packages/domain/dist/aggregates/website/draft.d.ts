import type { AggregateVersion, AuditTrail, LocaleCode, OrganizationId, Slug, ThemeId, VersionString, WebsiteId } from "../../shared/index.js";
import type { WebsiteSettings, WebsiteStatus } from "../../website/index.js";
export type WebsiteDraftVersion = AggregateVersion & {
    readonly __websiteDraft: true;
};
export interface WebsiteDraft {
    readonly id: WebsiteId;
    readonly organizationId: OrganizationId;
    readonly slug: Slug;
    name: string;
    customDomain: string | null;
    fallbackDomain: string;
    status: WebsiteStatus;
    publishedVersion: VersionString | null;
    themeId: ThemeId | null;
    defaultLocale: LocaleCode;
    enabledLocales: readonly LocaleCode[];
    settings: WebsiteSettings;
    readonly version: WebsiteDraftVersion;
    readonly audit: AuditTrail;
    archivedAt: null;
}
export declare const WEBSITE_DRAFT_VERSION: WebsiteDraftVersion;
//# sourceMappingURL=draft.d.ts.map