import type { OrganizationId, Result, UserId, Website } from "@livingsites/domain";
import type { AuthorizationService } from "../../../authorization/service.js";
import type { WebsiteReader } from "../../../repositories/website.js";
export declare function listOrganizationWebsites(input: {
    readonly organizationId: OrganizationId;
}, deps: {
    readonly authenticatedUser: {
        readonly userId: UserId;
    };
    readonly authorizationService: AuthorizationService;
    readonly websiteReader: WebsiteReader;
}): Promise<Result<readonly Website[], {
    readonly code: "unauthorized";
    readonly message: string;
}>>;
//# sourceMappingURL=index.d.ts.map