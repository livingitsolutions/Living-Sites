"use server";

import type { PageBuilderState } from "@livingsites/application";
import { getComposition } from "@/app/lib/composition";
import { getOrganizationAdminContext, runWithOrganizationTenant } from "../../../../../../../lib/admin-context";

export type BuilderActionResult = { readonly ok: true; readonly state: PageBuilderState } | { readonly ok: false; readonly code: string; readonly message: string };
export type PublishActionResult = { readonly ok: true; readonly revisionNumber: number; readonly snapshotId: string } | { readonly ok: false; readonly code: string; readonly message: string };
export type RollbackActionResult = { readonly ok: true; readonly revisionNumber: number; readonly snapshotId: string } | { readonly ok: false; readonly code: string; readonly message: string };
const depsFor = (composition: ReturnType<typeof getComposition>, userId: never) => ({ authenticatedUser: { userId }, authorizationService: composition.authorizationService, websiteReader: composition.websiteRepository, pageReader: composition.pageRepository, pageMutationPersistence: composition.pageRepository, clock: composition.clock, idGenerator: composition.idGenerator });
async function contextFor(organizationId: string) { const context = await getOrganizationAdminContext(organizationId); return context.kind === "authorized" ? context : null; }
const output = (result: Awaited<ReturnType<ReturnType<typeof getComposition>["addSection"]>>): BuilderActionResult => result.ok ? { ok: true, state: result.value } : { ok: false, code: result.error.code, message: result.error.message };

export async function addSectionAction(organizationId: string, websiteId: string, pageId: string, expectedVersion: number, sectionTypeKey: string): Promise<BuilderActionResult> {
  const context = await contextFor(organizationId); if (!context) return { ok: false, code: "unauthorized", message: "You are not authorized to edit this Page." }; const composition = getComposition();
  return output(await runWithOrganizationTenant(context, () => composition.addSection({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: pageId as never, expectedVersion, sectionTypeKey }, depsFor(composition, context.platformUser.id as never)), websiteId));
}
export async function updateSectionAction(organizationId: string, websiteId: string, pageId: string, expectedVersion: number, sectionId: string, props: Record<string, unknown>): Promise<BuilderActionResult> {
  const context = await contextFor(organizationId); if (!context) return { ok: false, code: "unauthorized", message: "You are not authorized to edit this Page." }; const composition = getComposition();
  return output(await runWithOrganizationTenant(context, () => composition.updateSection({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: pageId as never, expectedVersion, sectionId: sectionId as never, props }, depsFor(composition, context.platformUser.id as never)), websiteId));
}
export async function removeSectionAction(organizationId: string, websiteId: string, pageId: string, expectedVersion: number, sectionId: string): Promise<BuilderActionResult> {
  const context = await contextFor(organizationId); if (!context) return { ok: false, code: "unauthorized", message: "You are not authorized to edit this Page." }; const composition = getComposition();
  return output(await runWithOrganizationTenant(context, () => composition.removeSection({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: pageId as never, expectedVersion, sectionId: sectionId as never }, depsFor(composition, context.platformUser.id as never)), websiteId));
}
export async function duplicateSectionAction(organizationId: string, websiteId: string, pageId: string, expectedVersion: number, sectionId: string): Promise<BuilderActionResult> {
  const context = await contextFor(organizationId); if (!context) return { ok: false, code: "unauthorized", message: "You are not authorized to edit this Page." }; const composition = getComposition();
  return output(await runWithOrganizationTenant(context, () => composition.duplicateSection({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: pageId as never, expectedVersion, sectionId: sectionId as never }, depsFor(composition, context.platformUser.id as never)), websiteId));
}
export async function reorderSectionsAction(organizationId: string, websiteId: string, pageId: string, expectedVersion: number, sectionIds: string[]): Promise<BuilderActionResult> {
  const context = await contextFor(organizationId); if (!context) return { ok: false, code: "unauthorized", message: "You are not authorized to edit this Page." }; const composition = getComposition();
  return output(await runWithOrganizationTenant(context, () => composition.reorderSections({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: pageId as never, expectedVersion, sectionIds: sectionIds as never }, depsFor(composition, context.platformUser.id as never)), websiteId));
}
export async function publishPageAction(organizationId: string, websiteId: string, pageId: string, expectedVersion: number): Promise<PublishActionResult> {
  const context = await contextFor(organizationId); if (!context) return { ok: false, code: "unauthorized", message: "You are not authorized to publish this Page." }; const composition = getComposition();
  const result = await runWithOrganizationTenant(context, () => composition.publishPage({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: pageId as never, expectedVersion }, { authenticatedUser: { userId: context.platformUser.id as never }, authorizationService: composition.authorizationService, websiteReader: composition.websiteRepository, pageReader: composition.pageRepository, pagePublisher: composition.pagePublisher, clock: composition.clock, idGenerator: composition.idGenerator }), websiteId);
  return result.ok ? { ok: true, revisionNumber: result.value.revisionNumber, snapshotId: result.value.id } : { ok: false, code: result.error.code, message: [result.error.message, ...(result.error.details ?? [])].join(" ") };
}

export async function rollbackPagePublicationAction(organizationId: string, websiteId: string, pageId: string, targetRevisionNumber: number, expectedVersion: number): Promise<RollbackActionResult> {
  const context = await contextFor(organizationId); if (!context) return { ok: false, code: "unauthorized", message: "You are not authorized to rollback this Page." }; const composition = getComposition();
  const result = await runWithOrganizationTenant(context, () => composition.rollbackPagePublication(
    { organizationId: context.organization.id, websiteId: websiteId as never, pageId: pageId as never, targetRevisionNumber, expectedVersion },
    { authenticatedUser: { userId: context.platformUser.id as never }, authorizationService: composition.authorizationService, websiteReader: composition.websiteRepository, pageReader: composition.pageRepository, pageSnapshotReader: composition.pageSnapshotReader, pageRollbackPersistence: composition.pageRollbackPersistence, clock: composition.clock, idGenerator: composition.idGenerator },
  ), websiteId);
  return result.ok ? { ok: true, revisionNumber: result.value.revisionNumber, snapshotId: result.value.id } : { ok: false, code: result.error.code, message: result.error.message };
}
