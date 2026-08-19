import { eq } from "drizzle-orm";
import { betterAuthSessions, betterAuthUsers } from "../../db/schema.js";
export class DrizzleOrphanIdentityDisabler {
    db;
    constructor(db) {
        this.db = db;
    }
    async disable(authSubjectId, disabledAt) {
        await this.db.transaction(async (tx) => {
            await tx
                .update(betterAuthUsers)
                .set({ disabled: true, disabled_at: disabledAt, updated_at: disabledAt })
                .where(eq(betterAuthUsers.id, authSubjectId));
            await tx.delete(betterAuthSessions).where(eq(betterAuthSessions.user_id, authSubjectId));
        });
    }
    async isDisabled(authSubjectId) {
        const [user] = await this.db
            .select({ disabled: betterAuthUsers.disabled })
            .from(betterAuthUsers)
            .where(eq(betterAuthUsers.id, authSubjectId))
            .limit(1);
        return user?.disabled ?? false;
    }
}
//# sourceMappingURL=drizzle-orphan-identity-disabler.js.map