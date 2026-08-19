import type { AggregateVersion, OrganizationId, Website, WebsiteCreatedEvent, WebsiteDraft, WebsiteId, WebsiteSettings } from "@livingsites/domain";
import type { CreateResult, SaveResult } from "../contracts.js";

export interface WebsiteReader {
  findById(id: WebsiteId): Promise<Website | null>;
  findByOrganizationAndSlug(organizationId: OrganizationId, slug: string): Promise<Website | null>;
  listForOrganization(organizationId: OrganizationId): Promise<readonly Website[]>;
  findByDomain(domain: string): Promise<Website | null>;
}

export interface WebsiteCreator { create(candidate: WebsiteDraft): Promise<CreateResult<Website>>; }

export interface WebsiteMutator {
  updateSettings(id: WebsiteId, settings: WebsiteSettings, expectedVersion: AggregateVersion): Promise<SaveResult<Website>>;
  archive(id: WebsiteId, expectedVersion: AggregateVersion): Promise<SaveResult<Website>>;
  restore(id: WebsiteId, expectedVersion: AggregateVersion): Promise<SaveResult<Website>>;
}

export interface WebsiteRepository extends WebsiteReader, WebsiteCreator, WebsiteMutator {}

export interface WebsiteCreationPersistence {
  createWithEvent(candidate: WebsiteDraft, event: WebsiteCreatedEvent): Promise<CreateResult<Website>>;
}
