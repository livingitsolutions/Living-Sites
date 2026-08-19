import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "./components/admin-shell";
import { AccessDenied, Card, EmptyState, PageHeader } from "./components/primitives";
import { getAuthenticatedAdminUser, listUserOrganizations } from "./lib/admin-context";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getAuthenticatedAdminUser("/admin");
  if (user.kind === "redirect") redirect(user.location);
  if (user.kind === "unrecognized") return <AccessDenied reason="Your signed-in identity is not linked to a platform user." />;

  const organizations = await listUserOrganizations(user.platformUser.id);

  return (
    <AdminShell user={user.sessionUser} organizations={organizations}>
      <PageHeader eyebrow="Workspace" title="Choose an organization" description="Open an organization to manage its websites and settings." />
      {organizations.length === 0 ? (
        <EmptyState title="No organizations available" description="Your account does not have an active organization membership." />
      ) : (
        <div className="organization-grid" data-testid="organization-list">
          {organizations.map(({ organization, role }) => (
            <Card key={organization.id} className="organization-card">
              <div>
                <p className="card-kicker">{role}</p>
                <h2>{organization.name}</h2>
                <p className="muted-text">{organization.slug}</p>
              </div>
              <Link className="button button-secondary" href={`/admin/organizations/${organization.id}`}>
                Open workspace
              </Link>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
