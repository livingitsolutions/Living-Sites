import type { OrganizationId, UserId, WebsiteId } from "@livingsites/domain";
import type { DrizzleDB } from "./drizzle-instance.js";
export type TenantContext = {
    readonly mode: "tenant";
    readonly userId: UserId;
    readonly organizationId: OrganizationId;
    readonly websiteId?: WebsiteId;
} | {
    readonly mode: "directory";
    readonly userId: UserId;
} | {
    readonly mode: "public";
} | {
    readonly mode: "internal";
};
export declare class TenantContextDeniedError extends Error {
    constructor(message?: string);
}
export interface TenantContextRunner {
    run<T>(context: TenantContext, operation: () => Promise<T>): Promise<T>;
}
export declare function createTenantContextRunner(rootDb: DrizzleDB): TenantContextRunner;
export declare function tenantDatabase(rootDb: DrizzleDB): DrizzleDB;
export declare function currentTenantContext(): TenantContext | null;
//# sourceMappingURL=tenant-context.d.ts.map