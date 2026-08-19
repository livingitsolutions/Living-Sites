import type { MembershipId, RoleValue, AggregateVersion, UserId } from "@livingsites/domain";
export interface ChangeOrganizationMemberRoleInput {
    readonly membershipId: MembershipId | string;
    readonly newRole: RoleValue | string;
    readonly expectedVersion: AggregateVersion;
    readonly callerUserId: UserId | string;
}
//# sourceMappingURL=input.d.ts.map