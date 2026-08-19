import type { Result } from "@livingsites/domain";
import type { AddOrganizationMemberInput } from "./input.js";
import type { AddOrganizationMemberError } from "./errors.js";
export interface NormalizedAddOrganizationMemberInput {
    readonly organizationId: string;
    readonly userId: string;
    readonly role: string;
    readonly websiteScopeId: string | null;
    readonly callerUserId: string;
}
export declare function validateAddOrganizationMemberInput(input: AddOrganizationMemberInput): Result<NormalizedAddOrganizationMemberInput, AddOrganizationMemberError>;
//# sourceMappingURL=validator.d.ts.map