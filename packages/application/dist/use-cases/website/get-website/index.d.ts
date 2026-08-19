import type { OrganizationId, Result, UserId, Website, WebsiteId } from "@livingsites/domain";
import type { AuthorizationService } from "../../../authorization/service";
import type { WebsiteReader } from "../../../repositories/website";
export type GetWebsiteError = {
    readonly code: "unauthorized" | "not_found";
    readonly message: string;
};
export declare function getWebsite(input: {
    readonly organizationId: OrganizationId;
    readonly websiteId: WebsiteId;
}, deps: {
    readonly authenticatedUser: {
        readonly userId: UserId;
    };
    readonly authorizationService: AuthorizationService;
    readonly websiteReader: WebsiteReader;
}): Promise<Result<Website, GetWebsiteError>>;
//# sourceMappingURL=index.d.ts.map