/**
 * Composition root — production wiring.
 *
 * Requires concrete PlanRepository, EventPublisher, and Database dependencies
 * as parameters. No silent fallback to in-memory or no-op dependencies.
 * If required dependencies are missing, fails fast with a typed error.
 */
import { SystemClock, CryptoIdGenerator, ConsoleLogger } from "@livingsites/platform";
import { createDbConnection, DrizzleOrganizationRepository } from "@livingsites/infrastructure";
import { createOrganization } from "@livingsites/application";
export class MissingProductionDependencyError extends Error {
    missingDependencies;
    constructor(missing) {
        super(`Missing required production dependencies: ${missing.join(", ")}`);
        this.name = "MissingProductionDependencyError";
        this.missingDependencies = missing;
    }
}
export function composeProduction(deps) {
    const missing = [];
    if (!deps.databaseUrl)
        missing.push("databaseUrl");
    if (!deps.planRepository)
        missing.push("planRepository");
    if (!deps.eventPublisher)
        missing.push("eventPublisher");
    if (missing.length > 0) {
        throw new MissingProductionDependencyError(missing);
    }
    const logger = new ConsoleLogger("app", deps.logLevel ?? "info");
    const clock = new SystemClock();
    const idGenerator = new CryptoIdGenerator();
    const connection = createDbConnection({ url: deps.databaseUrl });
    const organizationRepository = new DrizzleOrganizationRepository({
        db: connection.db,
        logger,
    });
    const createOrganizationDeps = {
        organizationRepository,
        planRepository: deps.planRepository,
        eventPublisher: deps.eventPublisher,
        clock,
        idGenerator,
    };
    return {
        clock,
        idGenerator,
        logger,
        eventPublisher: deps.eventPublisher,
        organizationRepository,
        planRepository: deps.planRepository,
        createOrganization,
        createOrganizationDeps,
        close: async () => {
            await connection.close();
        },
    };
}
//# sourceMappingURL=production.js.map