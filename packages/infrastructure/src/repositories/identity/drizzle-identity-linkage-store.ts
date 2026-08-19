import type { DrizzleDB } from "../../db/drizzle-instance";
import { identityLinkages } from "../../db/identity-linkage-schema";

export interface PendingIdentityLinkage {
  readonly id: string;
  readonly authSubjectId: string;
  readonly email: string;
  readonly displayName: string;
  readonly createdAt: Date;
}

export class DrizzleIdentityLinkageStore {
  constructor(private readonly db: DrizzleDB) {}

  async recordPending(linkage: PendingIdentityLinkage): Promise<void> {
    await this.db
      .insert(identityLinkages)
      .values({
        id: linkage.id,
        auth_subject_id: linkage.authSubjectId,
        email: linkage.email,
        display_name: linkage.displayName,
        next_attempt_at: linkage.createdAt,
        created_at: linkage.createdAt,
        updated_at: linkage.createdAt,
      })
      .onConflictDoNothing({ target: identityLinkages.auth_subject_id });
  }
}
