import type { AggregateVersion, OrganizationId, Result, UserId, Website, WebsiteId } from "@livingsites/domain";
import type { Clock } from "@livingsites/platform";
import type { AuthorizationService } from "../../../authorization/service.js";
import type { WebsitePublicationPersistence, WebsiteReader } from "../../../repositories/website.js";
export type UnpublishWebsiteError = {
    readonly code: "unauthorized" | "website_not_found" | "website_archived" | "concurrency_conflict" | "persistence_error";
    readonly message: string;
};
export interface UnpublishWebsiteDeps {
    readonly authenticatedUser: {
        readonly userId: UserId;
    };
    readonly authorizationService: AuthorizationService;
    readonly websiteReader: WebsiteReader;
    readonly websitePublicationPersistence: WebsitePublicationPersistence;
    readonly clock: Clock;
}
export declare function unpublishWebsite(input: {
    readonly organizationId: OrganizationId;
    readonly websiteId: WebsiteId;
    readonly expectedVersion: AggregateVersion;
}, deps: UnpublishWebsiteDeps): Promise<Result<Website, UnpublishWebsiteError>>;
//# sourceMappingURL=index.d.ts.map