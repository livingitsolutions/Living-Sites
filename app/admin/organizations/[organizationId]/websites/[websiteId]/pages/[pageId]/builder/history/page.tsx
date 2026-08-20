import { PagePermissions } from "@livingsites/application";
import { getComposition } from "@/app/lib/composition";
import { getOrganizationAdminContext, runWithOrganizationTenant } from "../../../../../../../../lib/admin-context";
import { HistoryClient } from "./history-client";

export const dynamic = "force-dynamic";

export default async function VersionHistoryPage({ params }: { readonly params: Promise<{ organizationId: string; websiteId: string; pageId: string }> }) {
  const { organizationId, websiteId, pageId } = await params;
  const context = await getOrganizationAdminContext(organizationId);
  if (context.kind !== "authorized") return null;
  const composition = getComposition();
  const [historyResult, page, rollbackDecision] = await runWithOrganizationTenant(context, () => Promise.all([
    composition.listPagePublicationHistory({ organizationId: context.organization.id, websiteId: websiteId as never, pageId: pageId as never }, { authenticatedUser: { userId: context.platformUser.id as never }, authorizationService: composition.authorizationService, websiteReader: composition.websiteRepository, pageReader: composition.pageRepository, pageSnapshotReader: composition.pageSnapshotReader }),
    composition.pageRepository.findById(pageId as never),
    composition.authorizationService.can({ userId: context.platformUser.id, organizationId: context.organization.id, websiteId: websiteId as never, permission: PagePermissions.Publish }),
  ]), websiteId);
  if (!historyResult.ok || !page || page.websiteId !== websiteId) return <div className="centered-state"><h1>Version history unavailable</h1><p>{historyResult.ok ? "Page was not found in this Website." : historyResult.error.message}</p></div>;
  return <main className="version-history-page"><header className="version-history-header"><div><a href={`/admin/organizations/${organizationId}/websites/${websiteId}/pages/${pageId}/builder`}>← Back to builder</a><p>Immutable publication record</p><h1>Version history</h1><span>{page.title}</span></div><p>Rollback copies a historical snapshot into a new revision. Existing revisions are never changed.</p></header>{historyResult.value.length ? <HistoryClient organizationId={organizationId} websiteId={websiteId} pageId={pageId} pageVersion={page.version} history={historyResult.value} canRollback={rollbackDecision.allowed} /> : <div className="version-history-empty"><h2>No published revisions</h2><p>Publish this Page to create its first immutable snapshot.</p></div>}</main>;
}
