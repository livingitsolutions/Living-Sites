import type {
  MembershipId,
  OrganizationId,
  UserId,
  ISODateString,
  AuditTrail,
  LifecycleStatus,
  RoleValue,
} from "../../index.js";
import type { MembershipDraft } from "./membership-draft.js";
import { MEMBERSHIP_DRAFT_VERSION } from "./membership-draft.js";

export interface CreateMembershipDraftInput {
  readonly id: MembershipId;
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly role: RoleValue;
  readonly websiteScopeId?: string | null;
  readonly now: ISODateString;
  readonly createdBy?: UserId;
}

export function createMembershipDraft(input: CreateMembershipDraftInput): MembershipDraft {
  const audit: AuditTrail = {
    createdAt: input.now,
    updatedAt: input.now,
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
  };

  return {
    id: input.id,
    organizationId: input.organizationId,
    userId: input.userId,
    role: input.role,
    websiteScopeId: input.websiteScopeId ?? null,
    status: "active" as LifecycleStatus,
    version: MEMBERSHIP_DRAFT_VERSION,
    audit,
  };
}
