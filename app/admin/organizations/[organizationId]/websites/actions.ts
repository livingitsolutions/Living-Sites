"use server";

import { revalidatePath } from "next/cache";
import { getComposition } from "@/app/lib/composition";
import { getOrganizationAdminContext, runWithOrganizationTenant } from "../../../lib/admin-context";
import type { CreateWebsiteState } from "./create-website-state";

export async function createWebsiteAction(organizationId: string, _previousState: CreateWebsiteState, formData: FormData): Promise<CreateWebsiteState> {
  const context = await getOrganizationAdminContext(organizationId);
  if (context.kind !== "authorized") return { status: "error", message: "You are not authorized to create a Website in this organization." };

  const composition = getComposition();
  const result = await runWithOrganizationTenant(context, () => composition.createWebsite({
    organizationId,
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
  }, {
    authenticatedUser: { userId: context.platformUser.id },
    authorizationService: composition.authorizationService,
    organizationReader: composition.organizationRepository,
    planReader: composition.planReader,
    websiteReader: composition.websiteRepository,
    websiteCreationPersistence: composition.websiteCreationPersistence,
    clock: composition.clock,
    idGenerator: composition.idGenerator,
  }));

  if (!result.ok) {
    if (result.error.code === "input_validation" && (result.error.field === "name" || result.error.field === "slug")) {
      return { status: "error", message: "Check the highlighted field.", fieldErrors: { [result.error.field]: result.error.message } };
    }
    return { status: "error", message: result.error.message };
  }

  revalidatePath(`/admin/organizations/${organizationId}/websites`);
  revalidatePath(`/admin/organizations/${organizationId}`);
  return { status: "success", message: `${result.value.website.name} was created.` };
}

export async function publishWebsiteAction(organizationId: string, formData: FormData): Promise<void> {
  const context = await getOrganizationAdminContext(organizationId);
  if (context.kind !== "authorized") throw new Error("You are not authorized to publish this Website.");
  const websiteId = String(formData.get("websiteId") ?? "");
  const composition = getComposition();
  const result = await runWithOrganizationTenant(context, () => composition.publishWebsite({
    organizationId: context.organization.id,
    websiteId: websiteId as never,
    expectedVersion: Number(formData.get("version")),
  }, {
    authenticatedUser: { userId: context.platformUser.id },
    authorizationService: composition.authorizationService,
    websiteReader: composition.websiteRepository,
    pageReader: composition.pageRepository,
    websitePublicationPersistence: composition.websitePublicationPersistence,
    clock: composition.clock,
  }), websiteId);
  if (!result.ok) throw new Error(result.error.message);
  revalidatePath(`/admin/organizations/${organizationId}/websites`);
  revalidatePath(`/admin/organizations/${organizationId}/websites/${websiteId}/pages`);
}

export async function unpublishWebsiteAction(organizationId: string, formData: FormData): Promise<void> {
  const context = await getOrganizationAdminContext(organizationId);
  if (context.kind !== "authorized") throw new Error("You are not authorized to unpublish this Website.");
  const websiteId = String(formData.get("websiteId") ?? "");
  const composition = getComposition();
  const result = await runWithOrganizationTenant(context, () => composition.unpublishWebsite({
    organizationId: context.organization.id,
    websiteId: websiteId as never,
    expectedVersion: Number(formData.get("version")),
  }, {
    authenticatedUser: { userId: context.platformUser.id },
    authorizationService: composition.authorizationService,
    websiteReader: composition.websiteRepository,
    websitePublicationPersistence: composition.websitePublicationPersistence,
    clock: composition.clock,
  }), websiteId);
  if (!result.ok) throw new Error(result.error.message);
  revalidatePath(`/admin/organizations/${organizationId}/websites`);
  revalidatePath(`/admin/organizations/${organizationId}/websites/${websiteId}/pages`);
}
