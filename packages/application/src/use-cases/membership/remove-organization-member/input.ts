import type {
  MembershipId,
  AggregateVersion,
  UserId,
} from "@livingsites/domain";

export interface RemoveOrganizationMemberInput {
  readonly membershipId: MembershipId | string;
  readonly expectedVersion: AggregateVersion;
  readonly callerUserId: UserId | string;
}
