import type {
  Result,
  OrganizationId,
  UserId,
  MembershipId,
  ISODateString,
  OrganizationMemberAddedEvent,
} from "@livingsites/domain";
import { createMembershipDraft } from "@livingsites/domain";
import type { MembershipReader, MembershipCreator } from "../../../repositories/membership";
import type { UserReader } from "../../../repositories/user";
import type { EventPublisher } from "../../../services/event-publisher";
import type { AuthorizationService } from "../../../authorization/service";
import { OrganizationPermissions } from "../../../authorization/permissions";
import type { AddOrganizationMemberInput } from "./input";
import type { AddOrganizationMemberOutput } from "./output";
import type { AddOrganizationMemberError } from "./errors";
import { validateAddOrganizationMemberInput } from "./validator";

export interface AddOrganizationMemberDeps {
  readonly membershipRepository: MembershipReader & MembershipCreator;
  readonly userReader?: UserReader;
  readonly authorizationService: AuthorizationService;
  readonly eventPublisher: EventPublisher;
  readonly clock: { nowIso(): string };
  readonly idGenerator: { generatePrefixed(prefix: string): string; generate(): string };
}

export async function addOrganizationMember(
  input: AddOrganizationMemberInput,
  deps: AddOrganizationMemberDeps,
): Promise<Result<AddOrganizationMemberOutput, AddOrganizationMemberError>> {
  const validation = validateAddOrganizationMemberInput(input);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const { organizationId, userId, role, websiteScopeId, callerUserId, isPlatformSuperAdmin } = validation.value;

  // 1. Authorize caller
  const authDecision = await deps.authorizationService.can({
    userId: callerUserId as UserId,
    organizationId: organizationId as OrganizationId,
    permission: OrganizationPermissions.MembersInvite,
    isPlatformSuperAdmin,
  });

  if (!authDecision.allowed) {
    return {
      ok: false,
      error: { code: "unauthorized", message: authDecision.reason },
    };
  }

  // 2. Check if user exists (if userReader is provided)
  if (deps.userReader) {
    const user = await deps.userReader.findById(userId as UserId);
    if (!user) {
      return {
        ok: false,
        error: { code: "user_not_found", message: `User "${userId}" was not found.`, userId },
      };
    }
  }

  // 3. Check for existing active membership
  const existing = await deps.membershipRepository.findForUserAndOrganization(
    organizationId as OrganizationId,
    userId as UserId,
  );
  if (existing && existing.status === "active") {
    // If org-wide or same scope
    if (!websiteScopeId || existing.websiteScopeId === websiteScopeId) {
      return {
        ok: false,
        error: {
          code: "duplicate_membership",
          message: `User "${userId}" is already a member of organization "${organizationId}".`,
          userId,
        },
      };
    }
  }

  // 4. Create membership draft
  const membershipId = (deps.idGenerator.generatePrefixed ? deps.idGenerator.generatePrefixed("mem") : deps.idGenerator.generate()) as MembershipId;
  const now = deps.clock.nowIso() as ISODateString;

  const draft = createMembershipDraft({
    id: membershipId,
    organizationId: organizationId as OrganizationId,
    userId: userId as UserId,
    role: role as import("@livingsites/domain").RoleValue,
    websiteScopeId,
    now,
    createdBy: callerUserId as UserId,
  });

  // 5. Persist
  const createResult = await deps.membershipRepository.create(draft);
  if (!createResult.ok) {
    return { ok: false, error: createResult.error };
  }

  const persisted = createResult.value;

  // 6. Emit event
  const event: OrganizationMemberAddedEvent = {
    type: "organization.member_added",
    occurredAt: now,
    eventScope: { scope: "organization", organizationId: organizationId as OrganizationId },
    membershipId: persisted.id,
    userId: persisted.userId,
    role: persisted.role,
    websiteScopeId: persisted.websiteScopeId,
  };

  await deps.eventPublisher.publish(event);

  return { ok: true, value: { membership: persisted } };
}
