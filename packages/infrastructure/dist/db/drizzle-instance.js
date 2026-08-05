/**
 * Drizzle instance factory.
 *
 * Re-exports the Drizzle constructor and type so that the rest of the
 * Infrastructure layer can create and use Drizzle instances.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
function createDrizzle(url) {
    return drizzle(url, { schema });
}
export { createDrizzle as drizzle };
//# sourceMappingURL=drizzle-instance.js.map