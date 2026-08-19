import { identityLinkages } from "../../db/identity-linkage-schema";
export class DrizzleIdentityLinkageStore {
    db;
    constructor(db) {
        this.db = db;
    }
    async recordPending(linkage) {
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
//# sourceMappingURL=drizzle-identity-linkage-store.js.map