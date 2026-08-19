import type { LocaleCode, OrganizationId, ThemeId, WebsiteSettings } from "@livingsites/domain";
export interface CreateWebsiteInput {
    readonly organizationId: OrganizationId | string;
    readonly name: string;
    readonly slug: string;
    readonly themeId?: ThemeId | string | null;
    readonly defaultLocale?: LocaleCode | string;
    readonly enabledLocales?: readonly (LocaleCode | string)[];
    readonly settings?: Partial<WebsiteSettings>;
}
//# sourceMappingURL=input.d.ts.map