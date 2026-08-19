import type { AggregateVersion, ISODateString, OrganizationId, Page, PageId, Result, Section, SectionId, UserId, WebsiteId } from "@livingsites/domain";
import { PageStatus } from "@livingsites/domain";
import type { Clock, IdGenerator } from "@livingsites/platform";
import { PagePermissions } from "../../authorization/permissions.js";
import type { AuthorizationService } from "../../authorization/service.js";
import type { PageMutationPersistence, PageReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";
import { SECTION_TYPES, getSectionType, validateSectionProps } from "../../section-types/index.js";
import { proveWebsiteAccess } from "../page/shared.js";

export type BuilderErrorCode = "unauthorized" | "website_not_found" | "not_found" | "draft_only" | "invalid_section_type" | "invalid_props" | "cross_page_section" | "invalid_order" | "concurrency_conflict" | "persistence_error";
export type BuilderError = { readonly code: BuilderErrorCode; readonly message: string };
export interface PageBuilderState { readonly page: Page; readonly sections: readonly Section[]; readonly sectionTypes: typeof SECTION_TYPES; readonly canEdit: boolean }
type Context = { readonly organizationId: OrganizationId; readonly websiteId: WebsiteId; readonly pageId: PageId };
type MutationContext = Context & { readonly expectedVersion: AggregateVersion };
export interface BuilderDeps { readonly authenticatedUser: { readonly userId: UserId }; readonly authorizationService: AuthorizationService; readonly websiteReader: WebsiteReader; readonly pageReader: PageReader; readonly pageMutationPersistence: PageMutationPersistence; readonly clock: Clock; readonly idGenerator: IdGenerator }

async function loadPage(input: Context, deps: BuilderDeps, permission: typeof PagePermissions.Read | typeof PagePermissions.Update): Promise<Result<Page, BuilderError>> {
  const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission }, deps);
  if (!access.ok) return access;
  const page = await deps.pageReader.findById(input.pageId);
  if (!page || page.websiteId !== input.websiteId) return { ok: false, error: { code: "not_found", message: "Page was not found in this Website." } };
  if (permission === PagePermissions.Update && page.status === PageStatus.Archived) return { ok: false, error: { code: "draft_only", message: "Archived Pages cannot be edited in the builder." } };
  return { ok: true, value: page };
}

async function persist(page: Page, sections: readonly Section[], input: MutationContext, deps: BuilderDeps): Promise<Result<PageBuilderState, BuilderError>> {
  const saved = await deps.pageMutationPersistence.saveBuilder({ pageId: page.id, sections, expectedVersion: input.expectedVersion, updatedAt: deps.clock.nowIso(), updatedBy: String(deps.authenticatedUser.userId) });
  if (!saved.ok) return { ok: false, error: { code: "expectedVersion" in saved.error ? "concurrency_conflict" : "persistence_error", message: "expectedVersion" in saved.error ? "This Page changed in another session. Reload before trying again." : saved.error.message } };
  return { ok: true, value: { page: saved.value, sections: saved.value.sections, sectionTypes: SECTION_TYPES, canEdit: true } };
}

export async function getPageBuilderState(input: Context, deps: BuilderDeps): Promise<Result<PageBuilderState, BuilderError>> {
  const loaded = await loadPage(input, deps, PagePermissions.Read);
  if (!loaded.ok) return loaded;
  const editDecision = await deps.authorizationService.can({ userId: deps.authenticatedUser.userId, organizationId: input.organizationId, websiteId: input.websiteId, permission: PagePermissions.Update });
  return { ok: true, value: { page: loaded.value, sections: loaded.value.sections, sectionTypes: SECTION_TYPES, canEdit: editDecision.allowed && loaded.value.status !== PageStatus.Archived } };
}

export async function addSection(input: MutationContext & { readonly sectionTypeKey: string; readonly props?: Readonly<Record<string, unknown>> }, deps: BuilderDeps): Promise<Result<PageBuilderState, BuilderError>> {
  const loaded = await loadPage(input, deps, PagePermissions.Update); if (!loaded.ok) return loaded;
  const type = getSectionType(input.sectionTypeKey); if (!type) return { ok: false, error: { code: "invalid_section_type", message: "The requested SectionType is not registered." } };
  const props = input.props ?? type.defaultProps; const validated = validateSectionProps(type, props); if (!validated.ok) return { ok: false, error: { code: "invalid_props", message: validated.errors.join(" ") } };
  const now = deps.clock.nowIso() as ISODateString;
  const section: Section = { id: deps.idGenerator.generatePrefixed("section") as SectionId, pageId: loaded.value.id, websiteId: loaded.value.websiteId, sectionTypeId: type.id, props: validated.value, sortOrder: loaded.value.sections.length, status: "active", audit: { createdAt: now, updatedAt: now, createdBy: deps.authenticatedUser.userId, updatedBy: deps.authenticatedUser.userId } };
  return persist(loaded.value, [...loaded.value.sections, section], input, deps);
}

export async function updateSection(input: MutationContext & { readonly sectionId: SectionId; readonly props: Readonly<Record<string, unknown>> }, deps: BuilderDeps): Promise<Result<PageBuilderState, BuilderError>> {
  const loaded = await loadPage(input, deps, PagePermissions.Update); if (!loaded.ok) return loaded;
  const section = loaded.value.sections.find((candidate) => candidate.id === input.sectionId); if (!section) return { ok: false, error: { code: "cross_page_section", message: "Section does not belong to this Page." } };
  const type = getSectionType(String(section.sectionTypeId)); if (!type) return { ok: false, error: { code: "invalid_section_type", message: "Section references an unregistered SectionType." } };
  const validated = validateSectionProps(type, input.props); if (!validated.ok) return { ok: false, error: { code: "invalid_props", message: validated.errors.join(" ") } };
  const sections = loaded.value.sections.map((candidate) => candidate.id === section.id ? { ...candidate, props: validated.value, audit: { ...candidate.audit, updatedAt: deps.clock.nowIso() as ISODateString, updatedBy: deps.authenticatedUser.userId } } : candidate);
  return persist(loaded.value, sections, input, deps);
}

export async function removeSection(input: MutationContext & { readonly sectionId: SectionId }, deps: BuilderDeps): Promise<Result<PageBuilderState, BuilderError>> {
  const loaded = await loadPage(input, deps, PagePermissions.Update); if (!loaded.ok) return loaded;
  if (!loaded.value.sections.some((section) => section.id === input.sectionId)) return { ok: false, error: { code: "cross_page_section", message: "Section does not belong to this Page." } };
  return persist(loaded.value, loaded.value.sections.filter((section) => section.id !== input.sectionId), input, deps);
}

export async function duplicateSection(input: MutationContext & { readonly sectionId: SectionId }, deps: BuilderDeps): Promise<Result<PageBuilderState, BuilderError>> {
  const loaded = await loadPage(input, deps, PagePermissions.Update); if (!loaded.ok) return loaded;
  const index = loaded.value.sections.findIndex((section) => section.id === input.sectionId); if (index < 0) return { ok: false, error: { code: "cross_page_section", message: "Section does not belong to this Page." } };
  const original = loaded.value.sections[index]!; const now = deps.clock.nowIso() as ISODateString;
  const duplicate: Section = { ...original, id: deps.idGenerator.generatePrefixed("section") as SectionId, props: structuredClone(original.props), audit: { createdAt: now, updatedAt: now, createdBy: deps.authenticatedUser.userId, updatedBy: deps.authenticatedUser.userId } };
  const sections = [...loaded.value.sections]; sections.splice(index + 1, 0, duplicate);
  return persist(loaded.value, sections, input, deps);
}

export async function reorderSections(input: MutationContext & { readonly sectionIds: readonly SectionId[] }, deps: BuilderDeps): Promise<Result<PageBuilderState, BuilderError>> {
  const loaded = await loadPage(input, deps, PagePermissions.Update); if (!loaded.ok) return loaded;
  const existing = new Set(loaded.value.sections.map((section) => String(section.id))); const proposed = new Set(input.sectionIds.map(String));
  if (existing.size !== proposed.size || input.sectionIds.length !== proposed.size || [...existing].some((id) => !proposed.has(id))) return { ok: false, error: { code: "invalid_order", message: "Reorder must contain every Page Section exactly once." } };
  const byId = new Map(loaded.value.sections.map((section) => [String(section.id), section]));
  return persist(loaded.value, input.sectionIds.map((id, index) => ({ ...byId.get(String(id))!, sortOrder: index })), input, deps);
}
