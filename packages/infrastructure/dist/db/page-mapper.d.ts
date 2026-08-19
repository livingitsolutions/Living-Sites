import type { LocaleCode, Page, PageDraft, SectionId } from "@livingsites/domain";
import { PageStatus } from "@livingsites/domain";
import type { InvalidPersistenceStateError } from "@livingsites/application";
import type { PageRow, PageSectionRow } from "./schema";
type MapperResult = {
    ok: true;
    value: Page;
} | {
    ok: false;
    error: InvalidPersistenceStateError;
};
export declare function rowToPage(row: PageRow, sectionRows?: readonly PageSectionRow[]): MapperResult;
export declare function pageDraftToInsert(draft: PageDraft): {
    id: string;
    website_id: string;
    title: string;
    slug: string;
    description: string | null;
    is_homepage: boolean;
    status: PageStatus;
    published_snapshot_id: string | null;
    section_order: SectionId[];
    available_locales: LocaleCode[];
    parent_id: string | null;
    version: number;
    created_at: Date;
    updated_at: Date;
    created_by: string | null;
    updated_by: string | null;
    archived_at: null;
};
export {};
//# sourceMappingURL=page-mapper.d.ts.map