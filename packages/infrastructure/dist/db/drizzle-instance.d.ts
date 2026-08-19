/** Shared Drizzle database type — accepts both postgres-js and node-postgres clients. */
export type DrizzleDB = any;
export declare function createDrizzle(url: string): DrizzleDB;
export { createDrizzle as drizzle };
//# sourceMappingURL=drizzle-instance.d.ts.map