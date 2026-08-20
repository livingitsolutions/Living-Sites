import type { OrganizationId, PageId, PagePublicationRolledBackEvent, PagePublishedEvent, PageSnapshot, UserId, WebsiteId } from "@livingsites/domain";
import type { PagePublicationCandidate, PagePublicationError, PagePublisher, PageRollbackPersistence, PageSnapshotReader } from "@livingsites/application";
import type { Result } from "@livingsites/domain";
import type { Logger } from "@livingsites/platform";
import type { DrizzleDB } from "../../db/drizzle-instance.js";
export interface DrizzlePagePublicationRepositoryConfig {
    readonly db: DrizzleDB;
    readonly logger: Logger;
    readonly beforeSnapshotInsert?: () => void;
    readonly beforeOutboxInsert?: () => void;
}
export declare class DrizzlePagePublicationRepository implements PageSnapshotReader, PagePublisher, PageRollbackPersistence {
    private readonly config;
    constructor(config: DrizzlePagePublicationRepositoryConfig);
    private get db();
    findById(id: string): Promise<PageSnapshot | null>;
    findLatestForPage(pageId: PageId): Promise<PageSnapshot | null>;
    findByRevision(pageId: PageId, revisionNumber: number): Promise<PageSnapshot | null>;
    listForPage(pageId: PageId): Promise<readonly PageSnapshot[]>;
    publish(input: {
        readonly candidate: PagePublicationCandidate;
        readonly expectedPageVersion: number;
        readonly event: Omit<PagePublishedEvent, "revisionNumber" | "pageVersion">;
    }): Promise<Result<PageSnapshot, PagePublicationError>>;
    rollback(input: {
        readonly pageId: PageId;
        readonly websiteId: WebsiteId;
        readonly organizationId: OrganizationId;
        readonly targetRevisionNumber: number;
        readonly newSnapshotId: string;
        readonly expectedPageVersion: number;
        readonly rolledBackAt: string;
        readonly rolledBackBy: UserId;
        readonly event: Omit<PagePublicationRolledBackEvent, "targetSnapshotId" | "newRevisionNumber" | "pageVersion">;
    }): Promise<Result<PageSnapshot, PagePublicationError>>;
}
//# sourceMappingURL=drizzle-page-publication-repository.d.ts.map