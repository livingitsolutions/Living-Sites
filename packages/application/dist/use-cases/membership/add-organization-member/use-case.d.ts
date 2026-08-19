import type { Result } from "@livingsites/domain";
import type { MembershipReader, MembershipMutationPersistence } from "../../../repositories/membership.js";
import type { UserReader } from "../../../repositories/user.js";
import type { AuthorizationService } from "../../../authorization/service.js";
import type { AddOrganizationMemberInput } from "./input.js";
import type { AddOrganizationMemberOutput } from "./output.js";
import type { AddOrganizationMemberError } from "./errors.js";
export interface AddOrganizationMemberDeps {
    readonly membershipRepository: MembershipReader & MembershipMutationPersistence;
    readonly userReader?: UserReader;
    readonly authorizationService: AuthorizationService;
    readonly clock: {
        nowIso(): string;
    };
    readonly idGenerator: {
        generatePrefixed(prefix: string): string;
        generate(): string;
    };
}
export declare function addOrganizationMember(input: AddOrganizationMemberInput, deps: AddOrganizationMemberDeps): Promise<Result<AddOrganizationMemberOutput, AddOrganizationMemberError>>;
//# sourceMappingURL=use-case.d.ts.map