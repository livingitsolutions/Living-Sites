import type { Result } from "@livingsites/domain";
import type { AddOrganizationMemberInput } from "./input";
import type { AddOrganizationMemberError } from "./errors";
export interface NormalizedAddOrganizationMemberInput {
    readonly organizationId: string;
    readonly userId: string;
    readonly role: string;
    readonly websiteScopeId: string | null;
    readonly callerUserId: string;
    readonly isPlatformSuperAdmin: boolean;
}
export declare function validateAddOrganizationMemberInput(input: AddOrganizationMemberInput): Result<NormalizedAddOrganizationMemberInput, AddOrganizationMemberError>;
//# sourceMappingURL=validator.d.ts.map