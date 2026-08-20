import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getComposition } from "@/app/lib/composition";
import { getOrganizationAdminContext, runWithOrganizationTenant } from "../../../../lib/admin-context";

export default async function WebsiteWorkspaceLayout({ children, params }: { children: ReactNode; params: Promise<{ organizationId: string; websiteId: string }> }) {
  const { organizationId, websiteId } = await params;
  const context = await getOrganizationAdminContext(organizationId);
  if (context.kind !== "authorized") return null;
  const composition = getComposition();
  const result = await runWithOrganizationTenant(context, () => composition.getWebsite({ organizationId: context.organization.id, websiteId: websiteId as never }, { authenticatedUser: { userId: context.platformUser.id }, authorizationService: composition.authorizationService, websiteReader: composition.websiteRepository }), websiteId);
  if (!result.ok) notFound();
  const base = `/admin/organizations/${organizationId}/websites/${websiteId}`;
  return <div><div className="workspace-banner"><div><p className="eyebrow">Website workspace</p><strong>{result.value.name}</strong><span>/{result.value.slug}</span></div><nav aria-label="Website workspace"><Link href={`${base}/pages`}>Pages</Link><span>Builder · Coming Soon</span><span>Settings · Coming Soon</span></nav></div>{children}</div>;
}
