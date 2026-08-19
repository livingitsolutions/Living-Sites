import type { OrganizationId, Result, UserId, Website, WebsiteId } from "@livingsites/domain";
import type { PermissionKey } from "../../authorization/permissions";
import type { AuthorizationService } from "../../authorization/service";
import type { WebsiteReader } from "../../repositories/website";
export type PageAccessError = {
    readonly code: "unauthorized" | "website_not_found";
    readonly message: string;
};
export declare function proveWebsiteAccess(input: {
    organizationId: OrganizationId;
    websiteId: WebsiteId;
    userId: UserId;
    permission: PermissionKey;
}, deps: {
    authorizationService: AuthorizationService;
    websiteReader: WebsiteReader;
}): Promise<Result<Website, PageAccessError>>;
//# sourceMappingURL=shared.d.ts.map