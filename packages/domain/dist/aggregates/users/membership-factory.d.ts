import type { MembershipId, OrganizationId, UserId, ISODateString, RoleValue } from "../../index";
import type { MembershipDraft } from "./membership-draft";
export interface CreateMembershipDraftInput {
    readonly id: MembershipId;
    readonly organizationId: OrganizationId;
    readonly userId: UserId;
    readonly role: RoleValue;
    readonly websiteScopeId?: string | null;
    readonly now: ISODateString;
    readonly createdBy?: UserId;
}
export declare function createMembershipDraft(input: CreateMembershipDraftInput): MembershipDraft;
//# sourceMappingURL=membership-factory.d.ts.map