import type { Result } from "@livingsites/domain";
import { normalizeOrganizationRole } from "../../../authorization/roles";
import type { AddOrganizationMemberInput } from "./input";
import type { AddOrganizationMemberError } from "./errors";

export interface NormalizedAddOrganizationMemberInput {
  readonly organizationId: string;
  readonly userId: string;
  readonly role: string;
  readonly websiteScopeId: string | null;
  readonly callerUserId: string;
}

export function validateAddOrganizationMemberInput(
  input: AddOrganizationMemberInput,
): Result<NormalizedAddOrganizationMemberInput, AddOrganizationMemberError> {
  const organizationId = typeof input.organizationId === "string" ? input.organizationId.trim() : "";
  const userId = typeof input.userId === "string" ? input.userId.trim() : "";
  const callerUserId = typeof input.callerUserId === "string" ? input.callerUserId.trim() : "";
  const rawRole = typeof input.role === "string" ? input.role.trim() : "";

  if (!organizationId) {
    return { ok: false, error: { code: "validation_error", message: "organizationId is required." } };
  }
  if (!userId) {
    return { ok: false, error: { code: "validation_error", message: "userId is required." } };
  }
  if (!callerUserId) {
    return { ok: false, error: { code: "validation_error", message: "callerUserId is required." } };
  }

  const role = normalizeOrganizationRole(rawRole);
  if (!role) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: `Invalid role: "${rawRole}". Supported roles: owner, admin, editor, viewer.`,
      },
    };
  }

  const websiteScopeId = input.websiteScopeId ? String(input.websiteScopeId).trim() : null;

  return {
    ok: true,
    value: {
      organizationId,
      userId,
      role,
      websiteScopeId,
      callerUserId,
    },
  };
}
