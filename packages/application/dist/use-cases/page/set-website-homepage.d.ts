import type { AggregateVersion, OrganizationId, Page, PageId, Result, UserId, WebsiteId } from "@livingsites/domain";
import type { Clock } from "@livingsites/platform";
import type { AuthorizationService } from "../../authorization/service.js";
import type { PageHomepagePersistence, PageReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";
export type SetWebsiteHomepageError = {
    readonly code: "unauthorized" | "website_not_found" | "not_found" | "archived_target" | "already_homepage" | "concurrency_conflict" | "persistence_error";
    readonly message: string;
};
export declare function setWebsiteHomepage(input: {
    readonly organizationId: OrganizationId;
    readonly websiteId: WebsiteId;
    readonly pageId: PageId;
    readonly expectedVersion: AggregateVersion;
}, deps: {
    readonly authenticatedUser: {
        readonly userId: UserId;
    };
    readonly authorizationService: AuthorizationService;
    readonly websiteReader: WebsiteReader;
    readonly pageReader: PageReader;
    readonly pageHomepagePersistence: PageHomepagePersistence;
    readonly clock: Clock;
}): Promise<Result<Page, SetWebsiteHomepageError>>;
//# sourceMappingURL=set-website-homepage.d.ts.map