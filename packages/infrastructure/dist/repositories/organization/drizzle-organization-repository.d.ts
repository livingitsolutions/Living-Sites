import type { Logger } from "@livingsites/platform";
import type { Organization, OrganizationDraft, OrganizationId, PaginatedResult } from "@livingsites/domain";
import type { CreateResult } from "@livingsites/application";
import type { OrganizationReader, OrganizationCreator, OrganizationListParams } from "@livingsites/application";
import type { DrizzleDB } from "../../db/drizzle-instance.js";
export interface DrizzleOrganizationRepositoryConfig {
    readonly db: DrizzleDB;
    readonly logger: Logger;
}
export declare class DrizzleOrganizationRepository implements OrganizationReader, OrganizationCreator {
    private readonly rootDb;
    private readonly logger;
    constructor(config: DrizzleOrganizationRepositoryConfig);
    private get db();
    findById(id: OrganizationId): Promise<Organization | null>;
    findBySlug(slug: string): Promise<Organization | null>;
    list(params: OrganizationListParams): Promise<PaginatedResult<Organization>>;
    create(candidate: OrganizationDraft): Promise<CreateResult<Organization>>;
    private mapCreateError;
}
//# sourceMappingURL=drizzle-organization-repository.d.ts.map