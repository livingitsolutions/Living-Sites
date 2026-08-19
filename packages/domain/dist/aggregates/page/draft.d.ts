import type { AggregateVersion, AuditTrail, ISODateString, LocaleCode, PageId, SectionId, Slug, UserId, WebsiteId } from "../../shared";
import type { PageStatus } from "../../page";
export type PageDraftVersion = AggregateVersion & {
    readonly __pageDraft: true;
};
export interface PageDraft {
    readonly id: PageId;
    readonly websiteId: WebsiteId;
    readonly slug: Slug;
    title: string;
    description?: string;
    isHomepage: boolean;
    status: PageStatus;
    publishedSnapshotId: string | null;
    sectionOrder: readonly SectionId[];
    availableLocales: readonly LocaleCode[];
    parentId: PageId | null;
    readonly version: PageDraftVersion;
    readonly audit: AuditTrail;
    archivedAt: ISODateString | null;
}
export interface CreatePageDraftInput {
    readonly id: PageId;
    readonly websiteId: WebsiteId;
    readonly title: string;
    readonly slug: Slug;
    readonly now: ISODateString;
    readonly createdBy?: UserId;
    readonly description?: string;
    readonly parentId?: PageId | null;
    readonly isHomepage?: boolean;
}
export declare const PAGE_DRAFT_VERSION: PageDraftVersion;
//# sourceMappingURL=draft.d.ts.map