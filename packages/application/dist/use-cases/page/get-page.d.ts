import type { OrganizationId, Page, PageId, Result, UserId, WebsiteId } from "@livingsites/domain";
import type { AuthorizationService } from "../../authorization/service.js";
import type { PageReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";
export declare function getPage(input: {
    organizationId: OrganizationId;
    websiteId: WebsiteId;
    pageId: PageId;
}, deps: {
    authenticatedUser: {
        userId: UserId;
    };
    authorizationService: AuthorizationService;
    websiteReader: WebsiteReader;
    pageReader: PageReader;
}): Promise<Result<Page, {
    code: "unauthorized" | "website_not_found" | "not_found";
    message: string;
}>>;
//# sourceMappingURL=get-page.d.ts.map