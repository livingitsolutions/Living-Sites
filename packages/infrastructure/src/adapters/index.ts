/**
 * Adapter contracts barrel.
 *
 * Each adapter represents a provider capability — what a provider can do
 * without naming a specific provider. The composition root selects which
 * concrete implementation to bind to each adapter.
 */
export * from "./database/index.js";
export * from "./storage/index.js";
export * from "./search/index.js";
export * from "./email/index.js";
export * from "./cache/index.js";
export * from "./queue/index.js";
export * from "./telemetry/index.js";
export * from "./logging/index.js";
