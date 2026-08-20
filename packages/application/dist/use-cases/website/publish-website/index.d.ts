import type { AggregateVersion, OrganizationId, Result, UserId, Website, WebsiteId } from "@livingsites/domain";
import type { Clock } from "@livingsites/platform";
import type { AuthorizationService } from "../../../authorization/service.js";
import type { PageReader } from "../../../repositories/page.js";
import type { WebsitePublicationPersistence, WebsiteReader } from "../../../repositories/website.js";
export type PublishWebsiteError = {
    readonly code: "unauthorized" | "website_not_found" | "website_archived" | "not_ready" | "concurrency_conflict" | "persistence_error";
    readonly message: string;
};
export interface PublishWebsiteDeps {
    readonly authenticatedUser: {
        readonly userId: UserId;
    };
    readonly authorizationService: AuthorizationService;
    readonly websiteReader: WebsiteReader;
    readonly pageReader: PageReader;
    readonly websitePublicationPersistence: WebsitePublicationPersistence;
    readonly clock: Clock;
}
export declare function publishWebsite(input: {
    readonly organizationId: OrganizationId;
    readonly websiteId: WebsiteId;
    readonly expectedVersion: AggregateVersion;
}, deps: PublishWebsiteDeps): Promise<Result<Website, PublishWebsiteError>>;
//# sourceMappingURL=index.d.ts.map