import type { Result, UserId } from "@livingsites/domain";
import type { AuthorizationService } from "../../../authorization/service.js";
import type { OrganizationReader, PlanReader } from "../../../repositories/organization.js";
import type { WebsiteCreationPersistence, WebsiteReader } from "../../../repositories/website.js";
import type { CreateWebsiteInput } from "./input.js";
import type { CreateWebsiteOutput } from "./output.js";
import type { CreateWebsiteError } from "./errors.js";
export interface TrustedPlatformUserContext {
    readonly userId: UserId;
}
export interface CreateWebsiteDeps {
    readonly authenticatedUser: TrustedPlatformUserContext;
    readonly authorizationService: AuthorizationService;
    readonly organizationReader: OrganizationReader;
    readonly planReader: PlanReader;
    readonly websiteReader: WebsiteReader;
    readonly websiteCreationPersistence: WebsiteCreationPersistence;
    readonly clock: {
        nowIso(): string;
    };
    readonly idGenerator: {
        generatePrefixed(prefix: string): string;
    };
}
export declare function createWebsite(input: CreateWebsiteInput, deps: CreateWebsiteDeps): Promise<Result<CreateWebsiteOutput, CreateWebsiteError>>;
//# sourceMappingURL=use-case.d.ts.map