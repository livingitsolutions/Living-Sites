import type { DrizzleDB } from "../../db/drizzle-instance.js";
export interface PendingIdentityLinkage {
    readonly id: string;
    readonly authSubjectId: string;
    readonly email: string;
    readonly displayName: string;
    readonly createdAt: Date;
}
export declare class DrizzleIdentityLinkageStore {
    private readonly db;
    constructor(db: DrizzleDB);
    recordPending(linkage: PendingIdentityLinkage): Promise<void>;
}
//# sourceMappingURL=drizzle-identity-linkage-store.d.ts.map