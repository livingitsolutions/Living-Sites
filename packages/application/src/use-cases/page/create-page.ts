import type { ISODateString, OrganizationId, Page, PageCreatedEvent, PageId, Result, Slug, UserId, WebsiteId } from "@livingsites/domain";
import { createPageDraft, normalizePageSlug } from "@livingsites/domain";
import type { Clock, IdGenerator } from "@livingsites/platform";
import { PagePermissions } from "../../authorization/permissions.js";
import type { AuthorizationService } from "../../authorization/service.js";
import { PageSlugPolicy, PageWebsiteActivePolicy } from "../../policies/page/index.js";
import type { PageCreationPersistence, PageReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";
import { proveWebsiteAccess } from "./shared.js";

export type CreatePageError = { readonly code: "unauthorized" | "website_not_found" | "input_validation" | "policy_denial" | "duplicate_slug" | "persistence_error"; readonly message: string; readonly field?: "title" | "slug" };
export async function createPage(input: { organizationId: OrganizationId; websiteId: WebsiteId; title: string; slug: string; description?: string }, deps: { authenticatedUser: { userId: UserId }; authorizationService: AuthorizationService; websiteReader: WebsiteReader; pageReader: PageReader; pageCreationPersistence: PageCreationPersistence; clock: Clock; idGenerator: IdGenerator }): Promise<Result<Page, CreatePageError>> {
  const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission: PagePermissions.Create }, deps);
  if (!access.ok) return access;
  if (new PageWebsiteActivePolicy().evaluate(access.value.status).outcome === "deny") return { ok: false, error: { code: "policy_denial", message: "Pages cannot be created for an archived Website." } };
  let slug: Slug;
  try { slug = normalizePageSlug(input.slug); } catch (error) { return { ok: false, error: { code: "input_validation", message: String(error instanceof Error ? error.message : error), field: "slug" } }; }
  const duplicate = await deps.pageReader.findActiveBySlug(input.websiteId, slug);
  const slugDecision = new PageSlugPolicy().evaluate(slug, duplicate !== null);
  if (slugDecision.outcome === "deny") return { ok: false, error: { code: "duplicate_slug", message: slugDecision.message, field: "slug" } };
  const now = deps.clock.nowIso() as ISODateString;
  let draft;
  try { draft = createPageDraft({ id: deps.idGenerator.generatePrefixed("page") as PageId, websiteId: input.websiteId, title: input.title, slug, now, createdBy: deps.authenticatedUser.userId, ...(input.description ? { description: input.description } : {}) }); }
  catch (error) { return { ok: false, error: { code: "input_validation", message: String(error instanceof Error ? error.message : error), field: "title" } }; }
  const event: PageCreatedEvent = { type: "page.created", occurredAt: now, eventScope: { scope: "website", organizationId: input.organizationId, websiteId: input.websiteId }, pageId: draft.id, slug: String(draft.slug) };
  const result = await deps.pageCreationPersistence.createWithEvent(draft, event);
  if (!result.ok) return { ok: false, error: { code: result.error.code === "duplicate_key" ? "duplicate_slug" : "persistence_error", message: result.error.message, ...(result.error.code === "duplicate_key" ? { field: "slug" as const } : {}) } };
  return { ok: true, value: result.value };
}
