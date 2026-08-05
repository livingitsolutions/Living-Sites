/**
 * Database module — Drizzle ORM schema, connection, mapper, and migrations.
 *
 * All Drizzle types are confined to Infrastructure. Row types are NOT
 * exported from the public Infrastructure barrel — they stay private to
 * the Drizzle adapter module. Only approved adapters and composition-facing
 * factories are exported.
 */
export { organizations, orgStatusEnum } from "./schema";
export { createDbConnection } from "./connection";
//# sourceMappingURL=index.js.map