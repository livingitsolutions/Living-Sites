import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "../../components/admin-shell";
import { AccessDenied } from "../../components/primitives";
import { getOrganizationAdminContext } from "../../lib/admin-context";
import { buildOrganizationNavigation } from "../../lib/navigation-config";

export default async function OrganizationAdminLayout({ children, params }: { children: ReactNode; params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const context = await getOrganizationAdminContext(organizationId);
  if (context.kind === "redirect") redirect(context.location);
  if (context.kind === "unrecognized") return <AccessDenied reason="Your signed-in identity is not linked to a platform user." />;
  if (context.kind === "denied") return <AccessDenied reason={context.reason} />;

  const navigation = buildOrganizationNavigation(organizationId, context.permissions);
  return <AdminShell user={context.sessionUser} organization={context.organization} role={String(context.role)} navigation={navigation}>{children}</AdminShell>;
}
