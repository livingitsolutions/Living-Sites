/**
 * @livingsites/infrastructure — Ports & Adapters architecture.
 *
 * Exports only approved adapters and composition-facing factories.
 * Drizzle row types, raw database client types, and internal schema
 * types are NOT exported from this barrel.
 *
 * Dependency direction:
 *   composition → infrastructure → application (contracts)
 *                            → platform (runtime capabilities)
 *                            → domain (entity types)
 *   application / domain / platform → NEVER imports infrastructure
 */
export * from "./adapters";
export * from "./repositories";
export * from "./providers";
export { createDbConnection } from "./db";
export type { DatabaseConfig, DbConnection } from "./db";
export { DrizzleOrganizationRepository } from "./repositories/organization";
export type { DrizzleOrganizationRepositoryConfig } from "./repositories/organization";
export { DrizzlePlanReader } from "./repositories/plan";
export type { DrizzlePlanReaderConfig } from "./repositories/plan";
export { DrizzleFeatureReader } from "./repositories/feature";
export type { DrizzleFeatureReaderConfig } from "./repositories/feature";
export { OutboxEventPublisher, DrizzleOrganizationCreationPersistence, DrizzleOutboxProcessor } from "./repositories/outbox";
export type { OutboxEventPublisherConfig, OutboxPublishError, DrizzleOrganizationCreationPersistenceConfig, OutboxProcessorConfig } from "./repositories/outbox";
