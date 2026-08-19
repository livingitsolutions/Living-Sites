import type { AggregateVersion, OrganizationId, Page, PageId, Result, UserId, WebsiteId } from "@livingsites/domain";
import { normalizePageSlug } from "@livingsites/domain";
import type { Clock } from "@livingsites/platform";
import { PagePermissions } from "../../authorization/permissions.js";
import type { AuthorizationService } from "../../authorization/service.js";
import type { PageMutationPersistence, PageReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";
import { proveWebsiteAccess } from "./shared.js";

export async function updatePageDetails(input: { organizationId: OrganizationId; websiteId: WebsiteId; pageId: PageId; title: string; slug: string; description?: string; expectedVersion: AggregateVersion }, deps: { authenticatedUser: { userId: UserId }; authorizationService: AuthorizationService; websiteReader: WebsiteReader; pageReader: PageReader; pageMutationPersistence: PageMutationPersistence; clock: Clock }): Promise<Result<Page, { code: "unauthorized" | "website_not_found" | "not_found" | "input_validation" | "duplicate_slug" | "concurrency_conflict" | "persistence_error"; message: string }>> {
  const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission: PagePermissions.Update }, deps);
  if (!access.ok) return access;
  const current = await deps.pageReader.findById(input.pageId);
  if (!current || current.websiteId !== input.websiteId) return { ok: false, error: { code: "not_found", message: "Page was not found in this Website." } };
  const title = input.title.trim(); if (!title || title.length > 200) return { ok: false, error: { code: "input_validation", message: "Page title must contain 1 to 200 characters." } };
  let slug; try { slug = normalizePageSlug(input.slug); } catch (error) { return { ok: false, error: { code: "input_validation", message: String(error instanceof Error ? error.message : error) } }; }
  const duplicate = await deps.pageReader.findActiveBySlug(input.websiteId, slug);
  if (duplicate && duplicate.id !== input.pageId) return { ok: false, error: { code: "duplicate_slug", message: "An active Page already uses this slug." } };
  const saved = await deps.pageMutationPersistence.updateDetails({ pageId: input.pageId, title, slug, ...(input.description?.trim() ? { description: input.description.trim() } : {}), expectedVersion: input.expectedVersion, updatedAt: deps.clock.nowIso(), updatedBy: String(deps.authenticatedUser.userId) });
  if (!saved.ok) return { ok: false, error: { code: "expectedVersion" in saved.error ? "concurrency_conflict" : "persistence_error", message: "expectedVersion" in saved.error ? "Page changed since it was loaded." : saved.error.message } };
  return saved;
}
