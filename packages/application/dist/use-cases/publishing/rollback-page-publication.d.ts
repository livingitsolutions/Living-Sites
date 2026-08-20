import type { AggregateVersion, OrganizationId, PageId, PageSnapshot, Result, UserId, WebsiteId } from "@livingsites/domain";
import type { Clock, IdGenerator } from "@livingsites/platform";
import type { AuthorizationService } from "../../authorization/service.js";
import type { PageReader, PageRollbackPersistence, PageSnapshotReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";
export type RollbackPagePublicationError = {
    readonly code: "unauthorized" | "website_not_found" | "page_not_found" | "website_inactive" | "snapshot_not_found" | "concurrency_conflict" | "persistence_error";
    readonly message: string;
};
export interface RollbackPagePublicationDeps {
    readonly authenticatedUser: {
        readonly userId: UserId;
    };
    readonly authorizationService: AuthorizationService;
    readonly websiteReader: WebsiteReader;
    readonly pageReader: PageReader;
    readonly pageSnapshotReader: PageSnapshotReader;
    readonly pageRollbackPersistence: PageRollbackPersistence;
    readonly clock: Clock;
    readonly idGenerator: IdGenerator;
}
export declare function rollbackPagePublication(input: {
    readonly organizationId: OrganizationId;
    readonly websiteId: WebsiteId;
    readonly pageId: PageId;
    readonly targetRevisionNumber: number;
    readonly expectedVersion: AggregateVersion;
}, deps: RollbackPagePublicationDeps): Promise<Result<PageSnapshot, RollbackPagePublicationError>>;
//# sourceMappingURL=rollback-page-publication.d.ts.map