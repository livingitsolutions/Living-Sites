/**
 * @livingsites/platform — provider-independent runtime capabilities.
 *
 * Platform contains reusable runtime services that every application in Living
 * Sites depends on: configuration, environment, startup, logging, telemetry,
 * feature flags, clock, id generation, and health checks. These are not
 * business concerns (domain) and not persistence concerns (infrastructure) —
 * they are cross-cutting runtime concerns.
 *
 * Dependency direction:
 *   infrastructure → platform → (nothing internal)
 *   composition → platform (wires platform capabilities into providers)
 *   application / domain → NEVER import platform
 *   UI → NEVER import platform directly (receives capabilities through
 *        services wired by composition)
 *
 * Architecture-only milestone: contracts and documentation only.
 */
export * from "./config/index.js";
export * from "./environment/index.js";
export * from "./startup/index.js";
export * from "./logging/index.js";
export * from "./telemetry/index.js";
export * from "./feature-flags/index.js";
export * from "./clock/index.js";
export * from "./ids/index.js";
export * from "./health/index.js";
//# sourceMappingURL=index.d.ts.map