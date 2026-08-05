/**
 * Composition root — production wiring.
 *
 * Requires concrete PlanRepository, EventPublisher, and Database dependencies
 * as parameters. No silent fallback to in-memory or no-op dependencies.
 * If required dependencies are missing, fails fast with a typed error.
 */
import { SystemClock, CryptoIdGenerator, ConsoleLogger } from "@livingsites/platform";
import type { Clock, IdGenerator, Logger } from "@livingsites/platform";
import { createDbConnection, DrizzleOrganizationRepository } from "@livingsites/infrastructure";
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

export class MissingProductionDependencyError extends Error {
  readonly missingDependencies: readonly string[];

  constructor(missing: readonly string[]) {
    super(`Missing required production dependencies: ${missing.join(", ")}`);
    this.name = "MissingProductionDependencyError";
    this.missingDependencies = missing;
  }
}

export function composeProduction(deps: ProductionDependencies): ProductionComposition {
  const missing: string[] = [];
  if (!deps.databaseUrl) missing.push("databaseUrl");
  if (!deps.planRepository) missing.push("planRepository");
  if (!deps.eventPublisher) missing.push("eventPublisher");
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

  const createOrganizationDeps: CreateOrganizationDeps = {
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
