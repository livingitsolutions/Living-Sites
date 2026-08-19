import type { Membership } from "@livingsites/domain";

export interface GetOrganizationMembersOutput {
  readonly members: readonly Membership[];
}
