import type { Result, UserId } from "@livingsites/domain";
import type { AuthorizationService } from "../../../authorization/service";
import type { OrganizationReader, PlanReader } from "../../../repositories/organization";
import type { WebsiteCreationPersistence, WebsiteReader } from "../../../repositories/website";
import type { CreateWebsiteInput } from "./input";
import type { CreateWebsiteOutput } from "./output";
import type { CreateWebsiteError } from "./errors";
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