import type { Website, WebsiteCreatedEvent, WebsiteDraft } from "@livingsites/domain";
import type { CreateResult, WebsiteCreationPersistence } from "@livingsites/application";
import type { Logger } from "@livingsites/platform";
import type { DrizzleDB } from "../../db/drizzle-instance.js";
export declare class DrizzleWebsiteCreationPersistence implements WebsiteCreationPersistence {
    private readonly config;
    constructor(config: {
        readonly db: DrizzleDB;
        readonly logger: Logger;
        readonly beforeOutboxInsert?: () => void;
    });
    private get db();
    createWithEvent(candidate: WebsiteDraft, event: WebsiteCreatedEvent): Promise<CreateResult<Website>>;
}
//# sourceMappingURL=drizzle-website-creation-persistence.d.ts.map