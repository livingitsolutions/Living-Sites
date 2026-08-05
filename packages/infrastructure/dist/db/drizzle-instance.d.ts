import * as schema from "./schema";
export type DrizzleDB = ReturnType<typeof createDrizzle>;
declare function createDrizzle(url: string): import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> & {
    $client: import("postgres").Sql<{}>;
};
export { createDrizzle as drizzle };
//# sourceMappingURL=drizzle-instance.d.ts.map