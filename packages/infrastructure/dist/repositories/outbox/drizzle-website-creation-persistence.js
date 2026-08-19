import { randomUUID } from "node:crypto";
import { applicationOutbox, websites } from "../../db/schema";
import { buildOutboxInsert } from "../../db/outbox-mapper";
import { rowToWebsite, websiteDraftToInsert } from "../../db/website-mapper";
export class DrizzleWebsiteCreationPersistence {
    config;
    constructor(config) {
        this.config = config;
    }
    async createWithEvent(candidate, event) {
        try {
            const website = await this.config.db.transaction(async (tx) => {
                const [row] = await tx.insert(websites).values(websiteDraftToInsert(candidate)).returning();
                if (!row)
                    throw new Error("Website insert returned no row.");
                const mapped = rowToWebsite(row);
                if (!mapped.ok)
                    throw new Error(mapped.error.message);
                this.config.beforeOutboxInsert?.();
                await tx.insert(applicationOutbox).values(buildOutboxInsert({
                    id: randomUUID(),
                    eventType: event.type,
                    aggregateType: "website",
                    aggregateId: String(event.websiteId),
                    organizationId: String(event.eventScope.organizationId),
                    websiteId: String(event.websiteId),
                    payload: { type: event.type, occurredAt: event.occurredAt, websiteId: String(event.websiteId), organizationId: String(event.eventScope.organizationId), slug: event.slug },
                    occurredAt: new Date(event.occurredAt),
                    idempotencyKey: `website.created:${String(event.websiteId)}`,
                    schemaVersion: "1.0.0",
                }));
                return mapped.value;
            });
            return { ok: true, value: website };
        }
        catch (error) {
            const message = String(error);
            if (/duplicate|unique/i.test(message))
                return { ok: false, error: { code: "duplicate_key", message: "Website slug or domain already exists.", field: "slug", value: String(candidate.slug) } };
            this.config.logger.error("Atomic Website creation failed", { error: message });
            return { ok: false, error: { code: "invalid_persistence_state", message: "Website and event were not persisted." } };
        }
    }
}
//# sourceMappingURL=drizzle-website-creation-persistence.js.map