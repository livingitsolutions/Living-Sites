import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { WebsiteStatus } from "@livingsites/domain";
import { buildOutboxInsert } from "../../db/outbox-mapper.js";
import { applicationOutbox, websites } from "../../db/schema.js";
import { tenantDatabase } from "../../db/tenant-context.js";
import { rowToWebsite } from "../../db/website-mapper.js";
export class DrizzleWebsitePublicationRepository {
    config;
    constructor(config) {
        this.config = config;
    }
    get db() { return tenantDatabase(this.config.db); }
    async publishWithEvent(input) {
        return this.mutate({
            websiteId: String(input.websiteId),
            expectedVersion: input.expectedVersion,
            changedAt: input.changedAt,
            changedBy: String(input.changedBy),
            changes: { status: WebsiteStatus.Published, published_release_label: String(input.publishedVersion) },
            event: input.event,
        });
    }
    async unpublishWithEvent(input) {
        return this.mutate({
            websiteId: String(input.websiteId),
            expectedVersion: input.expectedVersion,
            changedAt: input.changedAt,
            changedBy: String(input.changedBy),
            changes: { status: WebsiteStatus.Unpublished },
            event: input.event,
        });
    }
    async mutate(input) {
        try {
            return await this.db.transaction(async (transaction) => {
                const changedAt = new Date(input.changedAt);
                const [row] = await transaction.update(websites).set({
                    ...input.changes,
                    version: input.expectedVersion + 1,
                    updated_at: changedAt,
                    updated_by: input.changedBy,
                }).where(and(eq(websites.id, input.websiteId), eq(websites.version, input.expectedVersion))).returning();
                if (!row)
                    return { ok: false, error: { code: "concurrency_conflict", message: "This Website changed in another session. Reload and try again." } };
                const mapped = rowToWebsite(row);
                if (!mapped.ok)
                    throw new Error(mapped.error.message);
                this.config.beforeOutboxInsert?.();
                await transaction.insert(applicationOutbox).values(buildOutboxInsert({
                    id: randomUUID(),
                    eventType: input.event.type,
                    aggregateType: "website",
                    aggregateId: input.websiteId,
                    organizationId: String(input.event.eventScope.organizationId),
                    websiteId: input.websiteId,
                    payload: { ...input.event },
                    occurredAt: changedAt,
                    idempotencyKey: `${input.event.type}:${input.websiteId}:${input.expectedVersion + 1}`,
                    schemaVersion: "1.0.0",
                }));
                return { ok: true, value: mapped.value };
            });
        }
        catch (error) {
            this.config.logger.error("Atomic Website publication mutation failed", { websiteId: input.websiteId, error: String(error) });
            return { ok: false, error: { code: "persistence_error", message: "Website state and publication event were rolled back." } };
        }
    }
}
//# sourceMappingURL=drizzle-website-publication-repository.js.map