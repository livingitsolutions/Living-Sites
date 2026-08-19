import type {
  Result,
  OrganizationId,
  UserId,
  MembershipId,
  ISODateString,
  OrganizationMemberAddedEvent,
} from "@livingsites/domain";
import { createMembershipDraft } from "@livingsites/domain";
import type { MembershipReader, MembershipMutationPersistence } from "../../../repositories/membership";
import type { UserReader } from "../../../repositories/user";
import type { AuthorizationService } from "../../../authorization/service";
import { OrganizationPermissions } from "../../../authorization/permissions";
import type { AddOrganizationMemberInput } from "./input";
import type { AddOrganizationMemberOutput } from "./output";
import type { AddOrganizationMemberError } from "./errors";
import { validateAddOrganizationMemberInput } from "./validator";

export interface AddOrganizationMemberDeps {
  readonly membershipRepository: MembershipReader & MembershipMutationPersistence;
  readonly userReader?: UserReader;
  readonly authorizationService: AuthorizationService;
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

  const { organizationId, userId, role, websiteScopeId, callerUserId } = validation.value;

  // 1. Authorize caller
  const authDecision = await deps.authorizationService.can({
    userId: callerUserId as UserId,
    organizationId: organizationId as OrganizationId,
    permission: OrganizationPermissions.MembersInvite,
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
  const existingMemberships = await deps.membershipRepository.listForUserAndOrganization(
    organizationId as OrganizationId,
    userId as UserId,
  );
  const duplicate = existingMemberships.some((membership) =>
    (membership.websiteScopeId ?? null) === websiteScopeId,
  );
  if (duplicate) {
    return {
      ok: false,
      error: {
        code: "duplicate_membership",
        message: `User "${userId}" already has an active membership for this organization scope.`,
        userId,
      },
    };
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

  const event: OrganizationMemberAddedEvent = {
    type: "organization.member_added",
    occurredAt: now,
    eventScope: { scope: "organization", organizationId: organizationId as OrganizationId },
    membershipId,
    userId: userId as UserId,
    role,
    websiteScopeId,
  };

  const createResult = await deps.membershipRepository.createWithEvent(draft, event);
  if (!createResult.ok) {
    return { ok: false, error: createResult.error };
  }

  return { ok: true, value: { membership: createResult.value } };
}
