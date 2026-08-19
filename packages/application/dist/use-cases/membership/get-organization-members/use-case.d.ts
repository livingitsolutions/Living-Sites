import type { Result } from "@livingsites/domain";
import type { MembershipReader } from "../../../repositories/membership.js";
import type { AuthorizationService } from "../../../authorization/service.js";
import type { GetOrganizationMembersInput } from "./input.js";
import type { GetOrganizationMembersOutput } from "./output.js";
import type { GetOrganizationMembersError } from "./errors.js";
export interface GetOrganizationMembersDeps {
    readonly membershipRepository: MembershipReader;
    readonly authorizationService: AuthorizationService;
}
export declare function getOrganizationMembers(input: GetOrganizationMembersInput, deps: GetOrganizationMembersDeps): Promise<Result<GetOrganizationMembersOutput, GetOrganizationMembersError>>;
//# sourceMappingURL=use-case.d.ts.map