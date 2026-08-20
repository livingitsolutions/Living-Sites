/**
 * Website repository adapter contract.
 *
 * Website is the aggregate root; WebsiteSettings is a child entity with no
 * independent repository port. WebsiteSettings is persisted through the
 * WebsiteRepository as part of the Website aggregate.
 *
 * Drizzle persistence implementations are exported below.
 */
import type { WebsiteRepository } from "@livingsites/application";
import type { DatabaseBackedAdapter } from "../shared.js";
/**
 * Adapts WebsiteRepository to a database provider. WebsiteSettings is
 * persisted atomically with the Website root — no separate adapter needed.
 */
export interface WebsiteRepositoryAdapter extends DatabaseBackedAdapter {
    readonly websites: WebsiteRepository;
}
export { DrizzleWebsiteRepository } from "./drizzle-website-repository.js";
export { DrizzleWebsitePublicationRepository } from "./drizzle-website-publication-repository.js";
export type { DrizzleWebsitePublicationRepositoryConfig } from "./drizzle-website-publication-repository.js";
//# sourceMappingURL=index.d.ts.map