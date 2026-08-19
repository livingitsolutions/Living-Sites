import { Card, PageHeader, StatusBadge } from "../../components/primitives";
import { getOrganizationAdminContext } from "../../lib/admin-context";
import { getComposition } from "@/app/lib/composition";

export const dynamic = "force-dynamic";

export default async function OrganizationDashboard({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const context = await getOrganizationAdminContext(organizationId);
  if (context.kind !== "authorized") return null;
  const composition = getComposition();
  const websites = await composition.listOrganizationWebsites({ organizationId: context.organization.id }, { authenticatedUser: { userId: context.platformUser.id }, authorizationService: composition.authorizationService, websiteReader: composition.websiteRepository });
  const members = await composition.getOrganizationMembers({ organizationId, callerUserId: context.platformUser.id }, composition.getOrganizationMembersDeps);

  return <><PageHeader eyebrow="Dashboard" title={`Welcome to ${context.organization.name}`} description="A concise view of the organization data available today." />
    <div className="metric-grid">
      <Card className="metric-card"><p>Websites</p><strong>{websites.ok ? websites.value.length : "—"}</strong><span>{websites.ok ? "Connected to this organization" : "Unavailable"}</span></Card>
      {members.ok ? <Card className="metric-card"><p>Members</p><strong>{members.value.members.length}</strong><span>Active organization memberships</span></Card> : null}
      <Card className="metric-card"><p>Organization</p><StatusBadge status={context.organization.status} /><span>Current lifecycle status</span></Card>
    </div>
  </>;
}
