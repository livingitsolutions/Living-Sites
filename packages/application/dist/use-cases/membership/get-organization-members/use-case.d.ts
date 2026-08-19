import type { Result } from "@livingsites/domain";
import type { MembershipReader } from "../../../repositories/membership";
import type { AuthorizationService } from "../../../authorization/service";
import type { GetOrganizationMembersInput } from "./input";
import type { GetOrganizationMembersOutput } from "./output";
import type { GetOrganizationMembersError } from "./errors";
export interface GetOrganizationMembersDeps {
    readonly membershipRepository: MembershipReader;
    readonly authorizationService: AuthorizationService;
}
export declare function getOrganizationMembers(input: GetOrganizationMembersInput, deps: GetOrganizationMembersDeps): Promise<Result<GetOrganizationMembersOutput, GetOrganizationMembersError>>;
//# sourceMappingURL=use-case.d.ts.map