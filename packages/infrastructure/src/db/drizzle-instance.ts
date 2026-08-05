/**
 * Drizzle instance factory.
 *
 * Re-exports the Drizzle constructor and type so that the rest of the
 * Infrastructure layer can create and use Drizzle instances.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type DrizzleDB = ReturnType<typeof createDrizzle>;

function createDrizzle(url: string) {
  return drizzle(url, { schema });
}

export { createDrizzle as drizzle };
