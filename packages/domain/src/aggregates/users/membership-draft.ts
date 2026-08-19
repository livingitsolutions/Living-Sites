import type {
  MembershipId,
  OrganizationId,
  UserId,
  AuditTrail,
  LifecycleStatus,
  AggregateVersion,
  RoleValue,
} from "../../index.js";
import { INITIAL_AGGREGATE_VERSION } from "../../shared/index.js";

export type MembershipDraftVersion = AggregateVersion & { readonly __draft: true };

export interface MembershipDraft {
  readonly id: MembershipId;
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  role: RoleValue;
  websiteScopeId?: string | null;
  status: LifecycleStatus;
  readonly version: MembershipDraftVersion;
  readonly audit: AuditTrail;
}

export const MEMBERSHIP_DRAFT_VERSION: MembershipDraftVersion = INITIAL_AGGREGATE_VERSION as MembershipDraftVersion;
