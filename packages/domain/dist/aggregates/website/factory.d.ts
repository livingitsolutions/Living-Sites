import type { ISODateString, LocaleCode, OrganizationId, Slug, ThemeId, UserId, WebsiteId } from "../../shared/index.js";
import { type WebsiteSettings } from "../../website/index.js";
import type { WebsiteDraft } from "./draft.js";
export declare function normalizeHostname(value: string): string;
export interface CreateWebsiteDraftInput {
    readonly id: WebsiteId;
    readonly organizationId: OrganizationId;
    readonly name: string;
    readonly slug: Slug;
    readonly now: ISODateString;
    readonly createdBy: UserId;
    readonly themeId?: ThemeId | null;
    readonly customDomain?: string | null;
    readonly fallbackDomain: string;
    readonly defaultLocale?: LocaleCode;
    readonly enabledLocales?: readonly LocaleCode[];
    readonly settings?: Partial<WebsiteSettings>;
}
export declare function createWebsiteDraft(input: CreateWebsiteDraftInput): WebsiteDraft;
//# sourceMappingURL=factory.d.ts.map