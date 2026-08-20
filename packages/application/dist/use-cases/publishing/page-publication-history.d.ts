import type { OrganizationId, PageId, PageSnapshot, Result, UserId, VersionString, WebsiteId } from "@livingsites/domain";
import type { AuthorizationService } from "../../authorization/service.js";
import type { PageReader, PageSnapshotReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";
export interface PagePublicationHistoryItem {
    readonly snapshotId: string;
    readonly revisionNumber: number;
    readonly releaseVersion?: VersionString;
    readonly publishedAt: string;
    readonly publishedBy: string;
    readonly isCurrent: boolean;
}
export interface PublishedPageRevision {
    readonly snapshotId: string;
    readonly revisionNumber: number;
    readonly releaseVersion?: VersionString;
    readonly publishedAt: string;
    readonly publishedBy: string;
    readonly isCurrent: boolean;
    readonly page: PageSnapshot["page"];
    readonly sections: PageSnapshot["sections"];
    readonly seo?: PageSnapshot["seo"];
}
export type PagePublicationQueryError = {
    readonly code: "unauthorized" | "website_not_found" | "page_not_found" | "snapshot_not_found";
    readonly message: string;
};
interface QueryInput {
    readonly organizationId: OrganizationId;
    readonly websiteId: WebsiteId;
    readonly pageId: PageId;
}
interface QueryDeps {
    readonly authenticatedUser: {
        readonly userId: UserId;
    };
    readonly authorizationService: AuthorizationService;
    readonly websiteReader: WebsiteReader;
    readonly pageReader: PageReader;
    readonly pageSnapshotReader: PageSnapshotReader;
}
export declare function listPagePublicationHistory(input: QueryInput, deps: QueryDeps): Promise<Result<readonly PagePublicationHistoryItem[], PagePublicationQueryError>>;
export declare function inspectPagePublication(input: QueryInput & {
    readonly snapshotId: string;
}, deps: QueryDeps): Promise<Result<PublishedPageRevision, PagePublicationQueryError>>;
export {};
//# sourceMappingURL=page-publication-history.d.ts.map