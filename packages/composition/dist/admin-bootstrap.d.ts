import type { User } from "@livingsites/domain";
import type { ProductionComposition } from "./production";
export interface AdminBootstrapInput {
    readonly email: string;
    readonly displayName?: string;
    readonly organizationName: string;
    readonly organizationSlug: string;
    readonly createdBy?: string;
}
export interface AdminBootstrapStatus {
    readonly betterAuthIdentity: {
        readonly id: string;
        readonly status: "active";
        readonly verified: true;
    };
    readonly platformUser: {
        readonly id: string;
        readonly status: "active";
    };
    readonly platformSuperAdmin: {
        readonly id: string;
        readonly status: "active";
        readonly singleton: true;
    };
    readonly organization: {
        readonly id: string;
        readonly status: "active";
    };
    readonly ownerMembership: {
        readonly id: string;
        readonly status: "active";
        readonly role: "owner";
    };
    readonly alreadyReconciled: boolean;
}
export type AdminBootstrapErrorCode = "invalid_input" | "identity_missing" | "bootstrap_locked" | "persistence_error" | "verification_failed";
export declare class AdminBootstrapError extends Error {
    readonly code: AdminBootstrapErrorCode;
    constructor(code: AdminBootstrapErrorCode, message: string);
}
export interface AdminBootstrapOptions {
    readonly createIdentity?: (input: {
        readonly email: string;
        readonly displayName: string;
    }) => Promise<User>;
}
export declare function reconcileProductionAdministrator(input: AdminBootstrapInput, composition: ProductionComposition, options?: AdminBootstrapOptions): Promise<AdminBootstrapStatus>;
//# sourceMappingURL=admin-bootstrap.d.ts.map