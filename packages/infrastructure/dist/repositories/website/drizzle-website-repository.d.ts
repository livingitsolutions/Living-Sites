import type { OrganizationId, Website, WebsiteDraft, WebsiteId, WebsiteSettings } from "@livingsites/domain";
import type { CreateResult, SaveResult, WebsiteRepository } from "@livingsites/application";
import type { Logger } from "@livingsites/platform";
import type { DrizzleDB } from "../../db/drizzle-instance.js";
export declare class DrizzleWebsiteRepository implements WebsiteRepository {
    private readonly config;
    constructor(config: {
        readonly db: DrizzleDB;
        readonly logger: Logger;
    });
    private get db();
    findById(id: WebsiteId): Promise<Website | null>;
    findByOrganizationAndSlug(organizationId: OrganizationId, slug: string): Promise<Website | null>;
    listForOrganization(organizationId: OrganizationId): Promise<readonly Website[]>;
    findByDomain(domain: string): Promise<Website | null>;
    create(candidate: WebsiteDraft): Promise<CreateResult<Website>>;
    updateSettings(id: WebsiteId, settings: WebsiteSettings, expectedVersion: number): Promise<SaveResult<Website>>;
    archive(id: WebsiteId, expectedVersion: number): Promise<SaveResult<Website>>;
    restore(id: WebsiteId, expectedVersion: number): Promise<SaveResult<Website>>;
    private update;
}
//# sourceMappingURL=drizzle-website-repository.d.ts.map