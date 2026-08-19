import type { Result } from "@livingsites/domain";
import type { MembershipReader, MembershipMutationPersistence } from "../../../repositories/membership";
import type { AuthorizationService } from "../../../authorization/service";
import type { RemoveOrganizationMemberInput } from "./input";
import type { RemoveOrganizationMemberOutput } from "./output";
import type { RemoveOrganizationMemberError } from "./errors";
export interface RemoveOrganizationMemberDeps {
    readonly membershipRepository: MembershipReader & MembershipMutationPersistence;
    readonly authorizationService: AuthorizationService;
    readonly clock: {
        nowIso(): string;
    };
}
export declare function removeOrganizationMember(input: RemoveOrganizationMemberInput, deps: RemoveOrganizationMemberDeps): Promise<Result<RemoveOrganizationMemberOutput, RemoveOrganizationMemberError>>;
//# sourceMappingURL=use-case.d.ts.map