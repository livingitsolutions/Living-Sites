/**
 * Membership row <-> aggregate mapping.
 *
 * Keeps Drizzle row types private to Infrastructure.
 */
import type {
  Membership,
  MembershipId,
  OrganizationId,
  UserId,
  ISODateString,
  LifecycleStatus,
  AggregateVersion,
  RoleValue,
  AuditTrail,
  Result,
} from "@livingsites/domain";
import type { MembershipDraft } from "@livingsites/domain";
import type { InvalidPersistenceStateError } from "@livingsites/application";
import { normalizeOrganizationRole } from "@livingsites/application";
import type { MembershipRow, MembershipInsert } from "./schema";

export function rowToMembership(row: MembershipRow): Result<Membership, InvalidPersistenceStateError> {
  if (!row.id || !row.organization_id || !row.user_id || !row.role) {
    return {
      ok: false,
      error: {
        code: "invalid_persistence_state",
        message: `Membership row ${row.id ?? "unknown"} has missing required fields.`,
      },
    };
  }
  const role = normalizeOrganizationRole(row.role);
  if (!role) {
    return {
      ok: false,
      error: {
        code: "invalid_persistence_state",
        message: `Membership row ${row.id} has invalid organization role "${row.role}".`,
      },
    };
  }

  const audit: AuditTrail = {
    createdAt: row.created_at.toISOString() as ISODateString,
    updatedAt: row.updated_at.toISOString() as ISODateString,
    ...(row.created_by ? { createdBy: row.created_by as UserId } : {}),
    ...(row.updated_by ? { updatedBy: row.updated_by as UserId } : {}),
  };

  const membership: Membership = {
    id: row.id as MembershipId,
    organizationId: row.organization_id as OrganizationId,
    userId: row.user_id as UserId,
    role: role as RoleValue,
    websiteScopeId: row.website_scope_id ?? null,
    status: row.status as LifecycleStatus,
    version: row.version as AggregateVersion,
    audit,
  };

  return { ok: true, value: membership };
}

export function membershipDraftToInsertData(
  draft: MembershipDraft | Omit<Membership, "id" | "audit" | "version"> & { id?: MembershipId; audit?: Partial<AuditTrail> },
  persistedVersion: number,
  generatedId?: string,
): MembershipInsert {
  const now = new Date();
  const id = draft.id ? String(draft.id) : (generatedId ?? String(draft.id));
  const createdAt = draft.audit?.createdAt ? new Date(draft.audit.createdAt) : now;
  const updatedAt = draft.audit?.updatedAt ? new Date(draft.audit.updatedAt) : now;

  return {
    id,
    organization_id: String(draft.organizationId),
    user_id: String(draft.userId),
    role: String(draft.role),
    website_scope_id: draft.websiteScopeId ? String(draft.websiteScopeId) : null,
    status: (draft.status ?? "active") as "active" | "archived" | "deleted",
    version: persistedVersion,
    created_at: createdAt,
    updated_at: updatedAt,
    created_by: draft.audit?.createdBy ? String(draft.audit.createdBy) : null,
    updated_by: draft.audit?.updatedBy ? String(draft.audit.updatedBy) : null,
    deleted_at: null,
  };
}
