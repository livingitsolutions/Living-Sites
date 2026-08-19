/**
 * Idempotent identity linkage reconciler.
 *
 * Finds 'pending' identity linkages that are due for retry and attempts
 * to create the corresponding Platform User. If successful, marks the
 * linkage as 'linked'. If all attempts are exhausted, marks it as 'failed'.
 *
 * This worker is idempotent: running it multiple times with the same pending
 * linkages produces the same result as running it once. It uses an atomic
 * claim-and-process pattern to prevent concurrent workers from processing
 * the same linkage.
 */
import { eq, and, lte, inArray, sql } from "drizzle-orm";
import { identityLinkages } from "../../db/identity-linkage-schema.js";
import { createUserDraft } from "@livingsites/domain";
export class LinkageReconciler {
    db;
    logger;
    userCreator;
    userReader;
    idGenerator;
    clock;
    identityDisabler;
    batchSize;
    gracePeriodMs;
    constructor(config) {
        this.db = config.db;
        this.logger = config.logger;
        this.userCreator = config.userCreator;
        this.userReader = config.userReader;
        this.idGenerator = config.idGenerator;
        this.clock = config.clock;
        this.identityDisabler = config.identityDisabler;
        this.batchSize = Math.max(1, Math.min(config.batchSize ?? 50, 100));
        this.gracePeriodMs = Math.max(1_000, config.gracePeriodMs ?? 60_000);
    }
    async reconcile() {
        const now = new Date(this.clock.nowIso());
        let processed = 0;
        let linked = 0;
        let failed = 0;
        let skipped = 0;
        const candidates = await this.db
            .select()
            .from(identityLinkages)
            .where(and(eq(identityLinkages.status, "pending"), lte(identityLinkages.next_attempt_at, now)))
            .limit(this.batchSize);
        if (candidates.length === 0)
            return { processed, linked, failed, skipped };
        const pending = await this.db
            .update(identityLinkages)
            .set({
            attempts: sql `${identityLinkages.attempts} + 1`,
            next_attempt_at: new Date(now.getTime() + this.gracePeriodMs),
            updated_at: now,
        })
            .where(and(eq(identityLinkages.status, "pending"), lte(identityLinkages.next_attempt_at, now), inArray(identityLinkages.id, candidates.map((row) => row.id))))
            .returning();
        for (const row of pending) {
            processed++;
            const result = await this.processLinkage(row);
            if (result === "linked")
                linked++;
            else if (result === "failed")
                failed++;
            else
                skipped++;
        }
        if (processed > 0) {
            this.logger.info("Linkage reconciliation complete", { processed, linked, failed, skipped });
        }
        return { processed, linked, failed, skipped };
    }
    async processLinkage(row) {
        const attempts = row.attempts;
        if (attempts > row.max_attempts) {
            return this.failAndDisable(row, attempts, "Max attempts exceeded");
        }
        const existingUser = await this.userReader.findByAuthSubjectId(row.auth_subject_id);
        if (existingUser) {
            await this.markLinked(row, String(existingUser.id), attempts);
            return "linked";
        }
        const draft = createUserDraft({
            id: this.idGenerator.generatePrefixed("user"),
            authSubjectId: row.auth_subject_id,
            email: row.email,
            displayName: row.display_name,
            now: this.clock.nowIso(),
        });
        const createResult = await this.userCreator.create(draft);
        if (createResult.ok) {
            await this.markLinked(row, String(createResult.value.id), attempts);
            this.logger.info("Linkage resolved", { linkageId: row.id, userId: String(createResult.value.id) });
            return "linked";
        }
        if (attempts >= row.max_attempts) {
            return this.failAndDisable(row, attempts, createResult.error.message);
        }
        const nextAttemptAt = new Date(new Date(this.clock.nowIso()).getTime() + Math.pow(2, attempts) * 1000);
        await this.db
            .update(identityLinkages)
            .set({
            failure_reason: createResult.error.message,
            next_attempt_at: nextAttemptAt,
            updated_at: new Date(this.clock.nowIso()),
        })
            .where(eq(identityLinkages.id, row.id));
        this.logger.warn("Linkage retry scheduled", { linkageId: row.id, attempts });
        return "skipped";
    }
    async markLinked(row, platformUserId, attempts) {
        const completedAt = new Date(this.clock.nowIso());
        await this.db
            .update(identityLinkages)
            .set({
            status: "linked",
            platform_user_id: platformUserId,
            attempts,
            failure_reason: null,
            updated_at: completedAt,
            completed_at: completedAt,
        })
            .where(eq(identityLinkages.id, row.id));
    }
    async failAndDisable(row, attempts, failureReason) {
        const completedAt = new Date(this.clock.nowIso());
        try {
            await this.identityDisabler.disable(row.auth_subject_id, completedAt);
        }
        catch {
            this.logger.error("Linkage identity disable failed", { linkageId: row.id, attempts });
            return "skipped";
        }
        await this.db
            .update(identityLinkages)
            .set({
            status: "failed",
            failure_reason: failureReason,
            attempts,
            updated_at: completedAt,
            completed_at: completedAt,
        })
            .where(eq(identityLinkages.id, row.id));
        this.logger.warn("Linkage failed and identity disabled", { linkageId: row.id, attempts });
        return "failed";
    }
}
//# sourceMappingURL=linkage-reconciler.js.map