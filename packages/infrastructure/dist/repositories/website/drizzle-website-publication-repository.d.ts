import type { Website } from "@livingsites/domain";
import type { WebsitePublicationPersistence, WebsitePublicationPersistenceError } from "@livingsites/application";
import type { Result } from "@livingsites/domain";
import type { Logger } from "@livingsites/platform";
import type { DrizzleDB } from "../../db/drizzle-instance.js";
export interface DrizzleWebsitePublicationRepositoryConfig {
    readonly db: DrizzleDB;
    readonly logger: Logger;
    readonly beforeOutboxInsert?: () => void;
}
export declare class DrizzleWebsitePublicationRepository implements WebsitePublicationPersistence {
    private readonly config;
    constructor(config: DrizzleWebsitePublicationRepositoryConfig);
    private get db();
    publishWithEvent(input: Parameters<WebsitePublicationPersistence["publishWithEvent"]>[0]): Promise<Result<Website, WebsitePublicationPersistenceError>>;
    unpublishWithEvent(input: Parameters<WebsitePublicationPersistence["unpublishWithEvent"]>[0]): Promise<Result<Website, WebsitePublicationPersistenceError>>;
    private mutate;
}
//# sourceMappingURL=drizzle-website-publication-repository.d.ts.map