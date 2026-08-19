import { eq } from "drizzle-orm";
import type { DrizzleDB } from "../../db/drizzle-instance.js";
import { betterAuthSessions, betterAuthUsers } from "../../db/schema.js";

export interface OrphanIdentityDisabler {
  disable(authSubjectId: string, disabledAt: Date): Promise<void>;
  isDisabled(authSubjectId: string): Promise<boolean>;
}

export class DrizzleOrphanIdentityDisabler implements OrphanIdentityDisabler {
  constructor(private readonly db: DrizzleDB) {}

  async disable(authSubjectId: string, disabledAt: Date): Promise<void> {
    await this.db.transaction(async (tx: DrizzleDB) => {
      await tx
        .update(betterAuthUsers)
        .set({ disabled: true, disabled_at: disabledAt, updated_at: disabledAt })
        .where(eq(betterAuthUsers.id, authSubjectId));
      await tx.delete(betterAuthSessions).where(eq(betterAuthSessions.user_id, authSubjectId));
    });
  }

  async isDisabled(authSubjectId: string): Promise<boolean> {
    const [user] = await this.db
      .select({ disabled: betterAuthUsers.disabled })
      .from(betterAuthUsers)
      .where(eq(betterAuthUsers.id, authSubjectId))
      .limit(1);
    return user?.disabled ?? false;
  }
}
