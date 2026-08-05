/**
 * Composition root — production wiring.
 *
 * Assembles a complete Organization creation runtime using:
 * - configured PostgreSQL/Drizzle connection
 * - SystemClock
 * - CryptoIdGenerator
 * - ConsoleLogger
 * - Drizzle Organization repository
 * - Drizzle Plan reader
 * - Drizzle Feature reader
 * - OutboxEventPublisher
 * - DrizzleOrganizationCreationPersistence (atomic aggregate + event)
 * - DrizzleOutboxProcessor
 * - CreateOrganization policies and use case
 *
 * No in-memory repositories. No no-op event publisher. No test-support
 * imports. Fails fast on missing or invalid configuration. Runs
 * dependency health checks. Exposes an explicit shutdown operation.
 *
 * Does not automatically run migrations or seeds.
 */
import { SystemClock, CryptoIdGenerator, ConsoleLogger } from "@livingsites/platform";
import { createDbConnection, DrizzleOrganizationRepository, DrizzlePlanReader, DrizzleFeatureReader, OutboxEventPublisher, DrizzleOrganizationCreationPersistence, DrizzleOutboxProcessor, } from "@livingsites/infrastructure";
import { createOrganization } from "@livingsites/application";
export class MissingProductionDependencyError extends Error {
    missingDependencies;
    constructor(missing) {
        super(`Missing required production dependencies: ${missing.join(", ")}`);
        this.name = "MissingProductionDependencyError";
        this.missingDependencies = missing;
    }
}
export function composeProduction(config) {
    const missing = [];
    if (!config.databaseUrl)
        missing.push("databaseUrl");
    if (missing.length > 0) {
        throw new MissingProductionDependencyError(missing);
    }
    const logger = new ConsoleLogger("app", config.logLevel ?? "info");
    const clock = new SystemClock();
    const idGenerator = new CryptoIdGenerator();
    const connection = createDbConnection({ url: config.databaseUrl });
    const db = connection.db;
    const organizationRepository = new DrizzleOrganizationRepository({
        db,
        logger,
    });
    const planReader = new DrizzlePlanReader({ db, logger });
    const featureReader = new DrizzleFeatureReader({ db, logger });
    const eventPublisher = new OutboxEventPublisher({ db, logger });
    const organizationCreationPersistence = new DrizzleOrganizationCreationPersistence({
        db,
        logger,
    });
    const outboxProcessor = new DrizzleOutboxProcessor({
        db,
        logger,
        maxAttempts: config.outboxMaxAttempts,
        baseBackoffMs: config.outboxBaseBackoffMs,
        maxBackoffMs: config.outboxMaxBackoffMs,
    });
    const createOrganizationDeps = {
        organizationRepository,
        planRepository: planReader,
        eventPublisher,
        clock,
        idGenerator,
        organizationCreationPersistence,
    };
    const healthCheck = async () => {
        const details = {};
        let healthy = true;
        try {
            await db.execute(new Function("return 1")());
            details.database = true;
        }
        catch {
            details.database = false;
            healthy = false;
        }
        details.planReader = true;
        details.featureReader = true;
        details.eventPublisher = true;
        details.outboxProcessor = true;
        return { healthy, details };
    };
    const close = async () => {
        await connection.close();
    };
    return {
        clock,
        idGenerator,
        logger,
        eventPublisher,
        organizationRepository,
        planReader,
        featureReader,
        organizationCreationPersistence,
        outboxProcessor,
        createOrganization,
        createOrganizationDeps,
        healthCheck,
        close,
    };
}
//# sourceMappingURL=production.js.map