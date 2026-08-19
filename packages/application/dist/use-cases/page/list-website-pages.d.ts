import type { OrganizationId, Page, PageStatus, Result, UserId, WebsiteId } from "@livingsites/domain";
import type { AuthorizationService } from "../../authorization/service.js";
import type { PageReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";
export declare function listWebsitePages(input: {
    organizationId: OrganizationId;
    websiteId: WebsiteId;
    status?: PageStatus;
}, deps: {
    authenticatedUser: {
        userId: UserId;
    };
    authorizationService: AuthorizationService;
    websiteReader: WebsiteReader;
    pageReader: PageReader;
}): Promise<Result<readonly Page[], {
    code: "unauthorized" | "website_not_found";
    message: string;
}>>;
//# sourceMappingURL=list-website-pages.d.ts.map