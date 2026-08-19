import type { DrizzleDB } from "../../db/drizzle-instance";
export interface OrphanIdentityDisabler {
    disable(authSubjectId: string, disabledAt: Date): Promise<void>;
    isDisabled(authSubjectId: string): Promise<boolean>;
}
export declare class DrizzleOrphanIdentityDisabler implements OrphanIdentityDisabler {
    private readonly db;
    constructor(db: DrizzleDB);
    disable(authSubjectId: string, disabledAt: Date): Promise<void>;
    isDisabled(authSubjectId: string): Promise<boolean>;
}
//# sourceMappingURL=drizzle-orphan-identity-disabler.d.ts.map