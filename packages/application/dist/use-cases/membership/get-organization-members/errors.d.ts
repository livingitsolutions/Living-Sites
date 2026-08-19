import type { PersistenceUnavailableError, InvalidPersistenceStateError } from "../../../contracts";
export type GetOrganizationMembersError = {
    readonly code: "validation_error";
    readonly message: string;
} | {
    readonly code: "unauthorized";
    readonly message: string;
} | PersistenceUnavailableError | InvalidPersistenceStateError;
//# sourceMappingURL=errors.d.ts.map