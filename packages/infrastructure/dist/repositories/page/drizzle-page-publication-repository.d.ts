import type { PageId, PagePublishedEvent, PageSnapshot } from "@livingsites/domain";
import type { PagePublicationCandidate, PagePublicationError, PagePublisher, PageSnapshotReader } from "@livingsites/application";
import type { Result } from "@livingsites/domain";
import type { Logger } from "@livingsites/platform";
import type { DrizzleDB } from "../../db/drizzle-instance";
export interface DrizzlePagePublicationRepositoryConfig {
    readonly db: DrizzleDB;
    readonly logger: Logger;
    readonly beforeSnapshotInsert?: () => void;
    readonly beforeOutboxInsert?: () => void;
}
export declare class DrizzlePagePublicationRepository implements PageSnapshotReader, PagePublisher {
    private readonly config;
    constructor(config: DrizzlePagePublicationRepositoryConfig);
    findById(id: string): Promise<PageSnapshot | null>;
    findLatestForPage(pageId: PageId): Promise<PageSnapshot | null>;
    findByRevision(pageId: PageId, revisionNumber: number): Promise<PageSnapshot | null>;
    publish(input: {
        readonly candidate: PagePublicationCandidate;
        readonly expectedPageVersion: number;
        readonly event: Omit<PagePublishedEvent, "revisionNumber" | "pageVersion">;
    }): Promise<Result<PageSnapshot, PagePublicationError>>;
}
//# sourceMappingURL=drizzle-page-publication-repository.d.ts.map