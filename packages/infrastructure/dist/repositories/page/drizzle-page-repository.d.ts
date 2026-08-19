import type { Page, PageArchivedEvent, PageCreatedEvent, PageDraft, PageId, PageRestoredEvent, PageStatus, Section, WebsiteId } from "@livingsites/domain";
import type { CreateResult, PageRepository, SaveResult } from "@livingsites/application";
import type { Logger } from "@livingsites/platform";
import type { DrizzleDB } from "../../db/drizzle-instance.js";
export interface DrizzlePageRepositoryConfig {
    readonly db: DrizzleDB;
    readonly logger: Logger;
    readonly beforeOutboxInsert?: () => void;
}
export declare class DrizzlePageRepository implements PageRepository {
    private readonly config;
    constructor(config: DrizzlePageRepositoryConfig);
    findById(id: PageId): Promise<Page | null>;
    findActiveBySlug(websiteId: WebsiteId, slug: string): Promise<Page | null>;
    listForWebsite(websiteId: WebsiteId, options?: {
        readonly status?: PageStatus;
    }): Promise<readonly Page[]>;
    createWithEvent(candidate: PageDraft, event: PageCreatedEvent): Promise<CreateResult<Page>>;
    updateDetails(input: {
        pageId: PageId;
        title: string;
        slug: string;
        description?: string;
        expectedVersion: number;
        updatedAt: string;
        updatedBy: string;
    }): Promise<SaveResult<Page>>;
    saveBuilder(input: {
        pageId: PageId;
        sections: readonly Section[];
        expectedVersion: number;
        updatedAt: string;
        updatedBy: string;
    }): Promise<SaveResult<Page>>;
    archiveWithEvent(input: {
        pageId: PageId;
        expectedVersion: number;
        archivedAt: string;
        archivedBy: string;
    }, event: PageArchivedEvent): Promise<SaveResult<Page>>;
    restoreWithEvent(input: {
        pageId: PageId;
        expectedVersion: number;
        restoredAt: string;
        restoredBy: string;
    }, event: PageRestoredEvent): Promise<SaveResult<Page>>;
    private outbox;
    private update;
    private atomicMutation;
}
//# sourceMappingURL=drizzle-page-repository.d.ts.map