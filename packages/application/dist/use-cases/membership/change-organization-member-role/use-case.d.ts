import type { Result } from "@livingsites/domain";
import type { MembershipReader, MembershipMutationPersistence } from "../../../repositories/membership.js";
import type { AuthorizationService } from "../../../authorization/service.js";
import type { ChangeOrganizationMemberRoleInput } from "./input.js";
import type { ChangeOrganizationMemberRoleOutput } from "./output.js";
import type { ChangeOrganizationMemberRoleError } from "./errors.js";
export interface ChangeOrganizationMemberRoleDeps {
    readonly membershipRepository: MembershipReader & MembershipMutationPersistence;
    readonly authorizationService: AuthorizationService;
    readonly clock: {
        nowIso(): string;
    };
}
export declare function changeOrganizationMemberRole(input: ChangeOrganizationMemberRoleInput, deps: ChangeOrganizationMemberRoleDeps): Promise<Result<ChangeOrganizationMemberRoleOutput, ChangeOrganizationMemberRoleError>>;
//# sourceMappingURL=use-case.d.ts.map