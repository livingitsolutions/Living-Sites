import type { AggregateVersion, OrganizationId, Page, PageArchivedEvent, PageCreatedEvent, PageDraft, PageId, PagePublishedEvent, PageRestoredEvent, PageSnapshot, PageStatus, Section, SectionSnapshotEntry, UserId, VersionString, WebsiteId } from "@livingsites/domain";
import type { CreateResult, SaveResult } from "../contracts.js";
import type { Result } from "@livingsites/domain";
export interface PageReader {
    findById(id: PageId): Promise<Page | null>;
    findActiveBySlug(websiteId: WebsiteId, slug: string): Promise<Page | null>;
    listForWebsite(websiteId: WebsiteId, options?: {
        readonly status?: PageStatus;
    }): Promise<readonly Page[]>;
}
export interface PageCreationPersistence {
    createWithEvent(candidate: PageDraft, event: PageCreatedEvent): Promise<CreateResult<Page>>;
}
export interface PageMutationPersistence {
    saveBuilder(input: {
        readonly pageId: PageId;
        readonly sections: readonly Section[];
        readonly expectedVersion: AggregateVersion;
        readonly updatedAt: string;
        readonly updatedBy: string;
    }): Promise<SaveResult<Page>>;
    updateDetails(input: {
        readonly pageId: PageId;
        readonly title: string;
        readonly slug: string;
        readonly description?: string;
        readonly expectedVersion: AggregateVersion;
        readonly updatedAt: string;
        readonly updatedBy: string;
    }): Promise<SaveResult<Page>>;
    archiveWithEvent(input: {
        readonly pageId: PageId;
        readonly expectedVersion: AggregateVersion;
        readonly archivedAt: string;
        readonly archivedBy: string;
    }, event: PageArchivedEvent): Promise<SaveResult<Page>>;
    restoreWithEvent(input: {
        readonly pageId: PageId;
        readonly expectedVersion: AggregateVersion;
        readonly restoredAt: string;
        readonly restoredBy: string;
    }, event: PageRestoredEvent): Promise<SaveResult<Page>>;
}
export interface PageRepository extends PageReader, PageCreationPersistence, PageMutationPersistence {
}
export interface PageSnapshotReader {
    findById(id: string): Promise<PageSnapshot | null>;
    findLatestForPage(pageId: PageId): Promise<PageSnapshot | null>;
    findByRevision(pageId: PageId, revisionNumber: number): Promise<PageSnapshot | null>;
}
export interface PagePublicationCandidate {
    readonly id: string;
    readonly pageId: PageId;
    readonly websiteId: WebsiteId;
    readonly organizationId: OrganizationId;
    readonly releaseVersion?: VersionString;
    readonly page: PageSnapshot["page"];
    readonly sections: readonly SectionSnapshotEntry[];
    readonly seo?: PageSnapshot["seo"];
    readonly publishedAt: PageSnapshot["publishedAt"];
    readonly publishedBy: UserId;
}
export type PagePublicationError = {
    readonly code: "concurrency_conflict";
    readonly message: string;
} | {
    readonly code: "persistence_error";
    readonly message: string;
};
export interface PagePublisher {
    publish(input: {
        readonly candidate: PagePublicationCandidate;
        readonly expectedPageVersion: AggregateVersion;
        readonly event: Omit<PagePublishedEvent, "revisionNumber" | "pageVersion">;
    }): Promise<Result<PageSnapshot, PagePublicationError>>;
}
//# sourceMappingURL=page.d.ts.map