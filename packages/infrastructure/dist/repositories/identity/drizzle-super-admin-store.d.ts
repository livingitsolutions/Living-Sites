import type { Logger } from "@livingsites/platform";
import type { User, UserId } from "@livingsites/domain";
import type { Result } from "@livingsites/domain";
import type { PlatformSuperAdminChecker } from "@livingsites/application";
import type { DrizzleDB } from "../../db/drizzle-instance";
import { type PlatformSuperAdminRow } from "../../db/schema";
export interface BootstrapSuperAdminInput {
    readonly email: string;
    readonly displayName?: string;
    readonly createdBy?: string;
}
export interface BootstrapSuperAdminOutput {
    readonly user: User;
    readonly alreadyExisted: boolean;
}
export type BootstrapSuperAdminError = {
    readonly code: "invalid_input";
    readonly message: string;
} | {
    readonly code: "bootstrap_locked";
    readonly message: string;
} | {
    readonly code: "persistence_error";
    readonly message: string;
};
export declare class DrizzleSuperAdminStore implements PlatformSuperAdminChecker {
    private readonly db;
    private readonly logger;
    private readonly userRepository;
    constructor(config: {
        db: DrizzleDB;
        logger: Logger;
    });
    isSuperAdmin(userId: UserId): Promise<boolean>;
    isSuperAdminByEmail(email: string): Promise<boolean>;
    listSuperAdmins(): Promise<PlatformSuperAdminRow[]>;
    bootstrap(input: BootstrapSuperAdminInput): Promise<Result<BootstrapSuperAdminOutput, BootstrapSuperAdminError>>;
}
//# sourceMappingURL=drizzle-super-admin-store.d.ts.map