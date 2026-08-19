import type { OrganizationId, Page, Result, UserId, WebsiteId } from "@livingsites/domain";
import type { Clock, IdGenerator } from "@livingsites/platform";
import type { AuthorizationService } from "../../authorization/service";
import type { PageCreationPersistence, PageReader } from "../../repositories/page";
import type { WebsiteReader } from "../../repositories/website";
export type CreatePageError = {
    readonly code: "unauthorized" | "website_not_found" | "input_validation" | "policy_denial" | "duplicate_slug" | "persistence_error";
    readonly message: string;
    readonly field?: "title" | "slug";
};
export declare function createPage(input: {
    organizationId: OrganizationId;
    websiteId: WebsiteId;
    title: string;
    slug: string;
    description?: string;
}, deps: {
    authenticatedUser: {
        userId: UserId;
    };
    authorizationService: AuthorizationService;
    websiteReader: WebsiteReader;
    pageReader: PageReader;
    pageCreationPersistence: PageCreationPersistence;
    clock: Clock;
    idGenerator: IdGenerator;
}): Promise<Result<Page, CreatePageError>>;
//# sourceMappingURL=create-page.d.ts.map