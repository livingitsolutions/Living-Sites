"use server";

import { revalidatePath } from "next/cache";
import { getComposition } from "@/app/lib/composition";
import { getOrganizationAdminContext } from "../../../../../lib/admin-context";
import type { PageActionState } from "./page-state";

const pathFor = (organizationId: string, websiteId: string) => `/admin/organizations/${organizationId}/websites/${websiteId}/pages`;
const depsFor = (composition: ReturnType<typeof getComposition>, userId: never) => ({ authenticatedUser: { userId }, authorizationService: composition.authorizationService, websiteReader: composition.websiteRepository, pageReader: composition.pageRepository, pageCreationPersistence: composition.pageRepository, pageMutationPersistence: composition.pageRepository, clock: composition.clock, idGenerator: composition.idGenerator });

export async function createPageAction(organizationId: string, websiteId: string, _state: PageActionState, formData: FormData): Promise<PageActionState> {
  const context = await getOrganizationAdminContext(organizationId); if (context.kind !== "authorized") return { status: "error", message: "You are not authorized to create Pages." };
  const composition = getComposition();
  const result = await composition.createPage({ organizationId: context.organization.id, websiteId: websiteId as never, title: String(formData.get("title") ?? ""), slug: String(formData.get("slug") ?? ""), description: String(formData.get("description") ?? "") }, depsFor(composition, context.platformUser.id as never));
  if (!result.ok) return { status: "error", message: result.error.message, ...(result.error.field ? { fieldErrors: { [result.error.field]: result.error.message } } : {}) };
  revalidatePath(pathFor(organizationId, websiteId)); return { status: "success", message: "Page created as a draft." };
}

export async function updatePageAction(organizationId: string, websiteId: string, _state: PageActionState, formData: FormData): Promise<PageActionState> {
  const context = await getOrganizationAdminContext(organizationId); if (context.kind !== "authorized") return { status: "error", message: "You are not authorized to update Pages." };
  const composition = getComposition(); const result = await composition.updatePageDetails({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: String(formData.get("pageId")) as never, title: String(formData.get("title") ?? ""), slug: String(formData.get("slug") ?? ""), description: String(formData.get("description") ?? ""), expectedVersion: Number(formData.get("version")) }, depsFor(composition, context.platformUser.id as never));
  if (!result.ok) return { status: "error", message: result.error.message }; revalidatePath(pathFor(organizationId, websiteId)); return { status: "success", message: "Page details updated." };
}

export async function archivePageAction(organizationId: string, websiteId: string, formData: FormData): Promise<void> {
  const context = await getOrganizationAdminContext(organizationId); if (context.kind !== "authorized") return;
  const composition = getComposition(); await composition.archivePage({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: String(formData.get("pageId")) as never, expectedVersion: Number(formData.get("version")) }, depsFor(composition, context.platformUser.id as never)); revalidatePath(pathFor(organizationId, websiteId));
}

export async function restorePageAction(organizationId: string, websiteId: string, formData: FormData): Promise<void> {
  const context = await getOrganizationAdminContext(organizationId); if (context.kind !== "authorized") return;
  const composition = getComposition(); await composition.restorePage({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: String(formData.get("pageId")) as never, expectedVersion: Number(formData.get("version")) }, depsFor(composition, context.platformUser.id as never)); revalidatePath(pathFor(organizationId, websiteId));
}
