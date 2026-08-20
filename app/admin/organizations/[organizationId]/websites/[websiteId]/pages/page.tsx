import { PagePermissions } from "@livingsites/application";
import { getComposition } from "@/app/lib/composition";
import { EmptyState, PageHeader } from "../../../../../components/primitives";
import { getOrganizationAdminContext, runWithOrganizationTenant } from "../../../../../lib/admin-context";
import { archivePageAction, createPageAction, restorePageAction, setHomepageAction, updatePageAction } from "./actions";
import { CreatePageForm } from "./page-forms";
import { PagesView } from "./pages-view";

export const dynamic = "force-dynamic";
export default async function PagesPage({ params }: { params: Promise<{ organizationId: string; websiteId: string }> }) {
  const { organizationId, websiteId } = await params; const context = await getOrganizationAdminContext(organizationId); if (context.kind !== "authorized") return null;
  const composition = getComposition(); const authorization = async (permission: typeof PagePermissions[keyof typeof PagePermissions]) => (await composition.authorizationService.can({ userId: context.platformUser.id, organizationId: context.organization.id, websiteId: websiteId as never, permission })).allowed;
  const [result, canCreate, canUpdate, canArchive] = await runWithOrganizationTenant(context, () => Promise.all([composition.listWebsitePages({ organizationId: context.organization.id, websiteId: websiteId as never }, { authenticatedUser: { userId: context.platformUser.id }, authorizationService: composition.authorizationService, websiteReader: composition.websiteRepository, pageReader: composition.pageRepository }), authorization(PagePermissions.Create), authorization(PagePermissions.Update), authorization(PagePermissions.Archive)]), websiteId);
  const createAction = createPageAction.bind(null, organizationId, websiteId); const updateAction = updatePageAction.bind(null, organizationId, websiteId); const archiveAction = archivePageAction.bind(null, organizationId, websiteId); const restoreAction = restorePageAction.bind(null, organizationId, websiteId); const homepageAction = setHomepageAction.bind(null, organizationId, websiteId);
  if (!result.ok) return <><PageHeader eyebrow="Content" title="Pages" description="Manage Website routes and Page lifecycle." /><EmptyState title="Pages unavailable" description={result.error.message} /></>;
  return <><PageHeader eyebrow="Content" title="Pages" description="Create drafts, maintain route metadata, and archive Pages without entering the Builder." action={canCreate ? <CreatePageForm action={createAction} /> : null} /><PagesView pages={result.value} canCreate={canCreate} canUpdate={canUpdate} canArchive={canArchive} createAction={createAction} updateAction={updateAction} archiveAction={archiveAction} restoreAction={restoreAction} setHomepageAction={homepageAction} /></>;
}
