import type { AggregateVersion, OrganizationId, Result, UserId, VersionString, Website, WebsiteCreatedEvent, WebsiteDraft, WebsiteId, WebsitePublishedEvent, WebsiteSettings, WebsiteUnpublishedEvent } from "@livingsites/domain";
import type { CreateResult, SaveResult } from "../contracts.js";

export interface WebsiteReader {
  findById(id: WebsiteId): Promise<Website | null>;
  findByOrganizationAndSlug(organizationId: OrganizationId, slug: string): Promise<Website | null>;
  listForOrganization(organizationId: OrganizationId): Promise<readonly Website[]>;
  findByDomain(domain: string): Promise<Website | null>;
}

export interface FallbackDomainProvider {
  hostnameFor(websiteId: WebsiteId): string;
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

export type WebsitePublicationPersistenceError =
  | { readonly code: "concurrency_conflict"; readonly message: string }
  | { readonly code: "persistence_error"; readonly message: string };

export interface WebsitePublicationPersistence {
  publishWithEvent(input: {
    readonly websiteId: WebsiteId;
    readonly expectedVersion: AggregateVersion;
    readonly publishedVersion: VersionString;
    readonly changedAt: string;
    readonly changedBy: UserId;
    readonly event: WebsitePublishedEvent;
  }): Promise<Result<Website, WebsitePublicationPersistenceError>>;
  unpublishWithEvent(input: {
    readonly websiteId: WebsiteId;
    readonly expectedVersion: AggregateVersion;
    readonly changedAt: string;
    readonly changedBy: UserId;
    readonly event: WebsiteUnpublishedEvent;
  }): Promise<Result<Website, WebsitePublicationPersistenceError>>;
}
