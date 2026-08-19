/**
 * Outbox adapters — Drizzle-backed event publisher, atomic creation
 * persistence, and outbox processor.
 *
 * Exports only the concrete adapter classes and their config types.
 * Drizzle row types are not exported.
 */
export { OutboxEventPublisher } from "./outbox-event-publisher.js";
export type { OutboxEventPublisherConfig, OutboxPublishError } from "./outbox-event-publisher.js";
export { DrizzleOrganizationCreationPersistence } from "./drizzle-organization-creation-persistence.js";
export type { DrizzleOrganizationCreationPersistenceConfig } from "./drizzle-organization-creation-persistence.js";
export { DrizzleWebsiteCreationPersistence } from "./drizzle-website-creation-persistence.js";
export { DrizzleOutboxProcessor } from "./drizzle-outbox-processor.js";
export type { OutboxProcessorConfig } from "./drizzle-outbox-processor.js";
