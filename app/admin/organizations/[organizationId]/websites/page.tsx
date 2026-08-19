import { getComposition } from "@/app/lib/composition";
import { EmptyState, PageHeader } from "../../../components/primitives";
import { getOrganizationAdminContext } from "../../../lib/admin-context";
import { createWebsiteAction } from "./actions";
import { CreateWebsiteForm } from "./create-website-form";
import { WebsitesView } from "./websites-view";

export const dynamic = "force-dynamic";

export default async function WebsitesPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const context = await getOrganizationAdminContext(organizationId);
  if (context.kind !== "authorized") return null;
  const composition = getComposition();
  const result = await composition.listOrganizationWebsites({ organizationId: context.organization.id }, {
    authenticatedUser: { userId: context.platformUser.id },
    authorizationService: composition.authorizationService,
    websiteReader: composition.websiteRepository,
  });

  if (!result.ok) return <><PageHeader eyebrow="Websites" title="Websites" description="Manage the sites owned by this organization." /><EmptyState title="Websites unavailable" description={result.error.message} /></>;
  const createAction = createWebsiteAction.bind(null, organizationId);

  return <>
    <PageHeader eyebrow="Websites" title="Websites" description="Manage names, publishing status, and domains from one place." action={context.canCreateWebsite ? <CreateWebsiteForm action={createAction} /> : null} />
    <WebsitesView organizationId={organizationId} websites={result.value} canCreate={context.canCreateWebsite} createAction={createAction} />
  </>;
}
