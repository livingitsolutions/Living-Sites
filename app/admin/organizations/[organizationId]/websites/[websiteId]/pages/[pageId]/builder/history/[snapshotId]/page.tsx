import { notFound } from "next/navigation";
import { getComposition } from "@/app/lib/composition";
import { RegisteredSectionRenderer } from "@/app/components/registered-section-renderer";
import { getOrganizationAdminContext, runWithOrganizationTenant } from "../../../../../../../../../lib/admin-context";

export const dynamic = "force-dynamic";

export default async function HistoricalRevisionPage({ params }: { readonly params: Promise<{ organizationId: string; websiteId: string; pageId: string; snapshotId: string }> }) {
  const { organizationId, websiteId, pageId, snapshotId } = await params;
  const context = await getOrganizationAdminContext(organizationId);
  if (context.kind !== "authorized") return null;
  const composition = getComposition();
  const result = await runWithOrganizationTenant(context, () => composition.inspectPagePublication(
    { organizationId: context.organization.id, websiteId: websiteId as never, pageId: pageId as never, snapshotId },
    { authenticatedUser: { userId: context.platformUser.id as never }, authorizationService: composition.authorizationService, websiteReader: composition.websiteRepository, pageReader: composition.pageRepository, pageSnapshotReader: composition.pageSnapshotReader },
  ), websiteId);
  if (!result.ok) notFound();
  const revision = result.value;
  return <main className="historical-preview"><header><a href={`/admin/organizations/${organizationId}/websites/${websiteId}/pages/${pageId}/builder/history`}>← Version history</a><div><p>Immutable snapshot</p><h1>Revision {revision.revisionNumber}</h1><span>{revision.isCurrent ? "Current publication" : `Published ${new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }).format(new Date(revision.publishedAt))}`}</span></div></header><article aria-label={`Preview of revision ${revision.revisionNumber}`}>{revision.sections.map((section) => <RegisteredSectionRenderer key={String(section.sectionId)} section={section} />)}</article></main>;
}
