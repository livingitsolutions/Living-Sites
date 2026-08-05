import type { Clock, IdGenerator, Logger } from "@livingsites/platform";
import type { PlanRepository, EventPublisher, OrganizationReader, OrganizationCreator } from "@livingsites/application";
import { createOrganization } from "@livingsites/application";
import type { CreateOrganizationDeps } from "@livingsites/application";
export interface ProductionDependencies {
    readonly databaseUrl: string;
    readonly planRepository: PlanRepository;
    readonly eventPublisher: EventPublisher;
    readonly logLevel?: "trace" | "debug" | "info" | "warn" | "error" | "silent";
}
export interface ProductionComposition {
    readonly clock: Clock;
    readonly idGenerator: IdGenerator;
    readonly logger: Logger;
    readonly eventPublisher: EventPublisher;
    readonly organizationRepository: OrganizationReader & OrganizationCreator;
    readonly planRepository: PlanRepository;
    readonly createOrganization: typeof createOrganization;
    readonly createOrganizationDeps: CreateOrganizationDeps;
    readonly close: () => Promise<void>;
}
export declare class MissingProductionDependencyError extends Error {
    readonly missingDependencies: readonly string[];
    constructor(missing: readonly string[]);
}
export declare function composeProduction(deps: ProductionDependencies): ProductionComposition;
//# sourceMappingURL=production.d.ts.map