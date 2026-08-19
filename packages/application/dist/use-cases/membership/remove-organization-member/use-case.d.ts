import type { Result } from "@livingsites/domain";
import type { MembershipReader, MembershipMutationPersistence } from "../../../repositories/membership.js";
import type { AuthorizationService } from "../../../authorization/service.js";
import type { RemoveOrganizationMemberInput } from "./input.js";
import type { RemoveOrganizationMemberOutput } from "./output.js";
import type { RemoveOrganizationMemberError } from "./errors.js";
export interface RemoveOrganizationMemberDeps {
    readonly membershipRepository: MembershipReader & MembershipMutationPersistence;
    readonly authorizationService: AuthorizationService;
    readonly clock: {
        nowIso(): string;
    };
}
export declare function removeOrganizationMember(input: RemoveOrganizationMemberInput, deps: RemoveOrganizationMemberDeps): Promise<Result<RemoveOrganizationMemberOutput, RemoveOrganizationMemberError>>;
//# sourceMappingURL=use-case.d.ts.map