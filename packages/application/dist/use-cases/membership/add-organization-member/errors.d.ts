import type { DuplicateKeyError, PersistenceUnavailableError, InvalidPersistenceStateError } from "../../../contracts.js";
export type AddOrganizationMemberError = {
    readonly code: "validation_error";
    readonly message: string;
} | {
    readonly code: "unauthorized";
    readonly message: string;
} | {
    readonly code: "user_not_found";
    readonly message: string;
    readonly userId: string;
} | {
    readonly code: "duplicate_membership";
    readonly message: string;
    readonly userId: string;
} | DuplicateKeyError | PersistenceUnavailableError | InvalidPersistenceStateError;
//# sourceMappingURL=errors.d.ts.map