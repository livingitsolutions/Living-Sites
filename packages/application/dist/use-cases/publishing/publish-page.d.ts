import type { AggregateVersion, OrganizationId, PageId, PageSnapshot, Result, UserId, VersionString, WebsiteId } from "@livingsites/domain";
import type { Clock, IdGenerator } from "@livingsites/platform";
import type { AuthorizationService } from "../../authorization/service";
import type { PagePublisher, PageReader } from "../../repositories/page";
import type { WebsiteReader } from "../../repositories/website";
export type PublishPageErrorCode = "unauthorized" | "website_not_found" | "page_not_found" | "website_inactive" | "draft_required" | "validation_failed" | "policy_failed" | "concurrency_conflict" | "persistence_error";
export type PublishPageError = {
    readonly code: PublishPageErrorCode;
    readonly message: string;
    readonly details?: readonly string[];
};
export interface PublishPageDeps {
    readonly authenticatedUser: {
        readonly userId: UserId;
    };
    readonly authorizationService: AuthorizationService;
    readonly websiteReader: WebsiteReader;
    readonly pageReader: PageReader;
    readonly pagePublisher: PagePublisher;
    readonly clock: Clock;
    readonly idGenerator: IdGenerator;
}
export declare function publishPage(input: {
    readonly organizationId: OrganizationId;
    readonly websiteId: WebsiteId;
    readonly pageId: PageId;
    readonly expectedVersion: AggregateVersion;
    readonly releaseVersion?: VersionString;
}, deps: PublishPageDeps): Promise<Result<PageSnapshot, PublishPageError>>;
//# sourceMappingURL=publish-page.d.ts.map