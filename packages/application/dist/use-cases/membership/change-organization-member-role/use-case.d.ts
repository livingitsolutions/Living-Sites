import type { Result } from "@livingsites/domain";
import type { MembershipReader, MembershipMutator } from "../../../repositories/membership";
import type { EventPublisher } from "../../../services/event-publisher";
import type { AuthorizationService } from "../../../authorization/service";
import type { ChangeOrganizationMemberRoleInput } from "./input";
import type { ChangeOrganizationMemberRoleOutput } from "./output";
import type { ChangeOrganizationMemberRoleError } from "./errors";
export interface ChangeOrganizationMemberRoleDeps {
    readonly membershipRepository: MembershipReader & MembershipMutator;
    readonly authorizationService: AuthorizationService;
    readonly eventPublisher: EventPublisher;
    readonly clock: {
        nowIso(): string;
    };
}
export declare function changeOrganizationMemberRole(input: ChangeOrganizationMemberRoleInput, deps: ChangeOrganizationMemberRoleDeps): Promise<Result<ChangeOrganizationMemberRoleOutput, ChangeOrganizationMemberRoleError>>;
//# sourceMappingURL=use-case.d.ts.map