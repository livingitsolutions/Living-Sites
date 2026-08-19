import type { ReactNode } from "react";
import type { Organization } from "@livingsites/domain";
import { AdminNavigation } from "./navigation";

type ShellUser = { name: string; email: string };

export function AdminShell({ children, user, organization, role, navigation, organizations }: { children: ReactNode; user: ShellUser; organization?: Organization; role?: string; navigation?: Array<{ label: string; href: string }>; organizations?: Array<{ organization: Organization; role: string }> }) {
  return <div className="admin-shell">
    <AdminNavigation organization={organization} navigation={navigation ?? []} />
    <div className="admin-workspace">
      <header className="admin-header">
        <div><p className="admin-context-label">{organization ? "Current organization" : "Living Sites Admin"}</p><strong>{organization?.name ?? "Organization directory"}</strong>{role ? <span className="role-pill">{role}</span> : null}</div>
        <div className="user-menu"><span className="user-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.email}</small></span><form action="/api/auth/sign-out" method="POST"><button className="text-button" type="submit">Sign out</button></form></div>
      </header>
      <main className="admin-content">{children}</main>
      {!organization && organizations ? <span className="sr-only">{organizations.length} organizations available</span> : null}
    </div>
  </div>;
}
