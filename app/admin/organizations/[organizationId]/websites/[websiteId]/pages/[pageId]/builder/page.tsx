import { getComposition } from "@/app/lib/composition";
import { getOrganizationAdminContext } from "../../../../../../../lib/admin-context";
import { BuilderClient } from "./builder-client";
import { PagePermissions } from "@livingsites/application";

export const dynamic = "force-dynamic";
export default async function BuilderPage({ params }: { readonly params: Promise<{ organizationId: string; websiteId: string; pageId: string }> }) {
  const { organizationId, websiteId, pageId } = await params; const context = await getOrganizationAdminContext(organizationId); if (context.kind !== "authorized") return null; const composition = getComposition();
  const result = await composition.getPageBuilderState({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: pageId as never }, { authenticatedUser: { userId: context.platformUser.id as never }, authorizationService: composition.authorizationService, websiteReader: composition.websiteRepository, pageReader: composition.pageRepository, pageMutationPersistence: composition.pageRepository, clock: composition.clock, idGenerator: composition.idGenerator });
  if (!result.ok) return <div className="centered-state"><h1>Builder unavailable</h1><p>{result.error.message}</p></div>;
  const publishDecision = await composition.authorizationService.can({ userId: context.platformUser.id, organizationId: context.organization.id, websiteId: websiteId as never, permission: PagePermissions.Publish });
  return <BuilderClient organizationId={organizationId} websiteId={websiteId} pageId={pageId} initialState={result.value} canPublish={publishDecision.allowed} />;
}
