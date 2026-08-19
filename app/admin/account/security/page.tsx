import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/app/components/password-forms";
import { AdminShell } from "@/app/admin/components/admin-shell";
import { AccessDenied, Card, PageHeader } from "@/app/admin/components/primitives";
import { getAuthenticatedAdminUser, listUserOrganizations } from "@/app/admin/lib/admin-context";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const user = await getAuthenticatedAdminUser("/admin/account/security");
  if (user.kind === "redirect") redirect(user.location);
  if (user.kind === "unrecognized") return <AccessDenied reason="Your signed-in identity is not linked to a platform user." />;
  const organizations = await listUserOrganizations(user.platformUser.id);

  return <AdminShell user={user.sessionUser} organizations={organizations}><PageHeader eyebrow="Account" title="Security" description="Change your password without changing your identity, roles, or organization access." /><Card className="security-card"><div className="security-card-heading"><p className="card-kicker">Password</p><h2>Update credentials</h2><p>Use a unique password with at least 12 characters.</p></div><ChangePasswordForm /></Card></AdminShell>;
}
