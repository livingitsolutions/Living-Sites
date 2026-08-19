/**
 * Membership row <-> aggregate mapping.
 *
 * Keeps Drizzle row types private to Infrastructure.
 */
import type { Membership, MembershipId, AuditTrail, Result } from "@livingsites/domain";
import type { MembershipDraft } from "@livingsites/domain";
import type { InvalidPersistenceStateError } from "@livingsites/application";
import type { MembershipRow, MembershipInsert } from "./schema.js";
export declare function rowToMembership(row: MembershipRow): Result<Membership, InvalidPersistenceStateError>;
export declare function membershipDraftToInsertData(draft: MembershipDraft | Omit<Membership, "id" | "audit" | "version"> & {
    id?: MembershipId;
    audit?: Partial<AuditTrail>;
}, persistedVersion: number, generatedId?: string): MembershipInsert;
//# sourceMappingURL=membership-mapper.d.ts.map