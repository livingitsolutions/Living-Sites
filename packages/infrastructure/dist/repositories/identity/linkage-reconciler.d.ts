import type { Logger } from "@livingsites/platform";
import type { DrizzleDB } from "../../db/drizzle-instance";
import type { UserCreator, UserReader } from "@livingsites/application";
import type { OrphanIdentityDisabler } from "./drizzle-orphan-identity-disabler";
export interface LinkageReconcilerConfig {
    readonly db: DrizzleDB;
    readonly logger: Logger;
    readonly userCreator: UserCreator;
    readonly userReader: UserReader;
    readonly idGenerator: {
        generatePrefixed(prefix: string): string;
    };
    readonly clock: {
        nowIso(): string;
    };
    readonly identityDisabler: OrphanIdentityDisabler;
    readonly batchSize?: number;
    readonly gracePeriodMs?: number;
}
export interface ReconciliationResult {
    readonly processed: number;
    readonly linked: number;
    readonly failed: number;
    readonly skipped: number;
}
export declare class LinkageReconciler {
    private readonly db;
    private readonly logger;
    private readonly userCreator;
    private readonly userReader;
    private readonly idGenerator;
    private readonly clock;
    private readonly identityDisabler;
    private readonly batchSize;
    private readonly gracePeriodMs;
    constructor(config: LinkageReconcilerConfig);
    reconcile(): Promise<ReconciliationResult>;
    private processLinkage;
    private markLinked;
    private failAndDisable;
}
//# sourceMappingURL=linkage-reconciler.d.ts.map