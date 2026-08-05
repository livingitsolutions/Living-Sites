import type { Clock, IdGenerator, Logger } from "@livingsites/platform";
import type { OrganizationReader, OrganizationCreator, PlanReader, FeatureReader, EventPublisher, OrganizationCreationPersistence, OutboxProcessor } from "@livingsites/application";
import { createOrganization } from "@livingsites/application";
import type { CreateOrganizationDeps } from "@livingsites/application";
export interface ProductionCompositionConfig {
    readonly databaseUrl: string;
    readonly logLevel?: "trace" | "debug" | "info" | "warn" | "error" | "silent";
    readonly outboxMaxAttempts?: number;
    readonly outboxBaseBackoffMs?: number;
    readonly outboxMaxBackoffMs?: number;
}
export interface ProductionComposition {
    readonly clock: Clock;
    readonly idGenerator: IdGenerator;
    readonly logger: Logger;
    readonly eventPublisher: EventPublisher;
    readonly organizationRepository: OrganizationReader & OrganizationCreator;
    readonly planReader: PlanReader;
    readonly featureReader: FeatureReader;
    readonly organizationCreationPersistence: OrganizationCreationPersistence;
    readonly outboxProcessor: OutboxProcessor;
    readonly createOrganization: typeof createOrganization;
    readonly createOrganizationDeps: CreateOrganizationDeps;
    readonly healthCheck: () => Promise<{
        healthy: boolean;
        details: Record<string, boolean>;
    }>;
    readonly close: () => Promise<void>;
}
export declare class MissingProductionDependencyError extends Error {
    readonly missingDependencies: readonly string[];
    constructor(missing: readonly string[]);
}
export declare function composeProduction(config: ProductionCompositionConfig): ProductionComposition;
//# sourceMappingURL=production.d.ts.map