import type { AggregateVersion, OrganizationId, Page, PageId, Result, UserId, WebsiteId } from "@livingsites/domain";
import type { Clock } from "@livingsites/platform";
import type { AuthorizationService } from "../../authorization/service.js";
import type { PageMutationPersistence, PageReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";
export declare function updatePageDetails(input: {
    organizationId: OrganizationId;
    websiteId: WebsiteId;
    pageId: PageId;
    title: string;
    slug: string;
    description?: string;
    expectedVersion: AggregateVersion;
}, deps: {
    authenticatedUser: {
        userId: UserId;
    };
    authorizationService: AuthorizationService;
    websiteReader: WebsiteReader;
    pageReader: PageReader;
    pageMutationPersistence: PageMutationPersistence;
    clock: Clock;
}): Promise<Result<Page, {
    code: "unauthorized" | "website_not_found" | "not_found" | "input_validation" | "duplicate_slug" | "concurrency_conflict" | "persistence_error";
    message: string;
}>>;
//# sourceMappingURL=update-page-details.d.ts.map