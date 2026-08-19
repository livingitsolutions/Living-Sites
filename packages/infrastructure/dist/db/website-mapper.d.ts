import type { LocaleCode, Website, WebsiteDraft, WebsiteSettings } from "@livingsites/domain";
import { WebsiteStatus } from "@livingsites/domain";
import type { InvalidPersistenceStateError } from "@livingsites/application";
import type { WebsiteRow } from "./schema";
type MapperResult = {
    ok: true;
    value: Website;
} | {
    ok: false;
    error: InvalidPersistenceStateError;
};
export declare function rowToWebsite(row: WebsiteRow): MapperResult;
export declare function websiteDraftToInsert(draft: WebsiteDraft, version?: number): {
    id: string;
    organization_id: string;
    name: string;
    slug: string;
    custom_domain: string | null;
    fallback_domain: string;
    status: WebsiteStatus;
    theme_id: string | null;
    published_release_label: string | null;
    default_locale: string;
    enabled_locales: LocaleCode[];
    settings: WebsiteSettings;
    version: number;
    created_at: Date;
    updated_at: Date;
    created_by: string | null;
    updated_by: string | null;
    archived_at: null;
};
export {};
//# sourceMappingURL=website-mapper.d.ts.map