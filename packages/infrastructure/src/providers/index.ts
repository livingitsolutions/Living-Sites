/**
 * Provider registration contracts.
 *
 * Exports the Netlify Database provider for use by the composition root.
 * All provider-specific code stays inside Infrastructure.
 */
export {
  createNetlifyDatabase,
  MissingNetlifyDatabaseError,
} from "./netlify-database/index.js";
export type {
  NetlifyDatabaseProvider,
  NetlifyDatabaseProviderConfig,
  NetlifyDrizzleDB,
} from "./netlify-database/index.js";
