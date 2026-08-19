"use server";

import type { PageBuilderState } from "@livingsites/application";
import { getComposition } from "@/app/lib/composition";
import { getOrganizationAdminContext } from "../../../../../../../lib/admin-context";

export type BuilderActionResult = { readonly ok: true; readonly state: PageBuilderState } | { readonly ok: false; readonly code: string; readonly message: string };
const depsFor = (composition: ReturnType<typeof getComposition>, userId: never) => ({ authenticatedUser: { userId }, authorizationService: composition.authorizationService, websiteReader: composition.websiteRepository, pageReader: composition.pageRepository, pageMutationPersistence: composition.pageRepository, clock: composition.clock, idGenerator: composition.idGenerator });
async function contextFor(organizationId: string) { const context = await getOrganizationAdminContext(organizationId); return context.kind === "authorized" ? context : null; }
const output = (result: Awaited<ReturnType<ReturnType<typeof getComposition>["addSection"]>>): BuilderActionResult => result.ok ? { ok: true, state: result.value } : { ok: false, code: result.error.code, message: result.error.message };

export async function addSectionAction(organizationId: string, websiteId: string, pageId: string, expectedVersion: number, sectionTypeKey: string): Promise<BuilderActionResult> {
  const context = await contextFor(organizationId); if (!context) return { ok: false, code: "unauthorized", message: "You are not authorized to edit this Page." }; const composition = getComposition();
  return output(await composition.addSection({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: pageId as never, expectedVersion, sectionTypeKey }, depsFor(composition, context.platformUser.id as never)));
}
export async function updateSectionAction(organizationId: string, websiteId: string, pageId: string, expectedVersion: number, sectionId: string, props: Record<string, unknown>): Promise<BuilderActionResult> {
  const context = await contextFor(organizationId); if (!context) return { ok: false, code: "unauthorized", message: "You are not authorized to edit this Page." }; const composition = getComposition();
  return output(await composition.updateSection({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: pageId as never, expectedVersion, sectionId: sectionId as never, props }, depsFor(composition, context.platformUser.id as never)));
}
export async function removeSectionAction(organizationId: string, websiteId: string, pageId: string, expectedVersion: number, sectionId: string): Promise<BuilderActionResult> {
  const context = await contextFor(organizationId); if (!context) return { ok: false, code: "unauthorized", message: "You are not authorized to edit this Page." }; const composition = getComposition();
  return output(await composition.removeSection({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: pageId as never, expectedVersion, sectionId: sectionId as never }, depsFor(composition, context.platformUser.id as never)));
}
export async function duplicateSectionAction(organizationId: string, websiteId: string, pageId: string, expectedVersion: number, sectionId: string): Promise<BuilderActionResult> {
  const context = await contextFor(organizationId); if (!context) return { ok: false, code: "unauthorized", message: "You are not authorized to edit this Page." }; const composition = getComposition();
  return output(await composition.duplicateSection({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: pageId as never, expectedVersion, sectionId: sectionId as never }, depsFor(composition, context.platformUser.id as never)));
}
export async function reorderSectionsAction(organizationId: string, websiteId: string, pageId: string, expectedVersion: number, sectionIds: string[]): Promise<BuilderActionResult> {
  const context = await contextFor(organizationId); if (!context) return { ok: false, code: "unauthorized", message: "You are not authorized to edit this Page." }; const composition = getComposition();
  return output(await composition.reorderSections({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: pageId as never, expectedVersion, sectionIds: sectionIds as never }, depsFor(composition, context.platformUser.id as never)));
}
