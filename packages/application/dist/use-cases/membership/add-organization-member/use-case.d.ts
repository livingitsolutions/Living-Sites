import type { Result } from "@livingsites/domain";
import type { MembershipReader, MembershipCreator } from "../../../repositories/membership";
import type { UserReader } from "../../../repositories/user";
import type { EventPublisher } from "../../../services/event-publisher";
import type { AuthorizationService } from "../../../authorization/service";
import type { AddOrganizationMemberInput } from "./input";
import type { AddOrganizationMemberOutput } from "./output";
import type { AddOrganizationMemberError } from "./errors";
export interface AddOrganizationMemberDeps {
    readonly membershipRepository: MembershipReader & MembershipCreator;
    readonly userReader?: UserReader;
    readonly authorizationService: AuthorizationService;
    readonly eventPublisher: EventPublisher;
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