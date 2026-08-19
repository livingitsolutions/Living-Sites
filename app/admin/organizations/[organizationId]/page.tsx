import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getComposition } from "@/app/lib/composition";
import { getAuth } from "@/app/lib/auth";
import { authPageRequest, evaluateAuthPageRequest } from "@/app/lib/auth-page-request";
import type { OrganizationId, UserId, AuthSubjectId } from "@livingsites/domain";
import { OrganizationPermissions } from "@livingsites/application";

export const dynamic = "force-dynamic";

interface OrganizationAdminPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function OrganizationAdminPage({ params }: OrganizationAdminPageProps) {
  const { organizationId } = await params;
  const auth = getAuth();
  const composition = getComposition();

  // 1. Server-side Authentication
  const decision = await evaluateAuthPageRequest(
    authPageRequest(`/admin/organizations/${organizationId}`, await headers()),
    auth,
  );

  if (decision.kind === "redirect") {
    redirect(decision.location);
  }

  const sessionUser = decision.session!.user;

  // 2. Resolve Platform User
  let platformUser = await composition.userReader.findByAuthSubjectId(sessionUser.id as AuthSubjectId);
  if (!platformUser && sessionUser.email) {
    platformUser = await composition.userReader.findByEmail(sessionUser.email);
  }

  if (!platformUser) {
    return (
      <main style={{ maxWidth: "600px", margin: "80px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ color: "#dc2626", fontSize: "1.5rem" }}>403 Forbidden</h1>
        <p data-testid="unauthorized" style={{ color: "#4b5563" }}>
          User identity is not recognized.
        </p>
      </main>
    );
  }

  // 3. Server-side Authorization
  const authDecision = await composition.authorizationService.can({
    userId: platformUser.id,
    organizationId: organizationId as OrganizationId,
    permission: OrganizationPermissions.Read,
  });

  if (!authDecision.allowed) {
    return (
      <main style={{ maxWidth: "600px", margin: "80px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ color: "#dc2626", fontSize: "1.5rem" }}>403 Forbidden</h1>
        <p data-testid="unauthorized" style={{ color: "#4b5563" }}>
          Forbidden: You do not have permission to access organization &quot;{organizationId}&quot;.
        </p>
        <p style={{ fontSize: "0.875rem", color: "#9ca3af" }}>Reason: {authDecision.reason}</p>
      </main>
    );
  }

  // 4. Load Organization Data
  const organization = await composition.organizationRepository.findById(organizationId as OrganizationId);

  // 5. Evaluate Resource Permissions
  const canReadMembersDecision = await composition.authorizationService.can({
    userId: platformUser.id,
    organizationId: organizationId as OrganizationId,
    permission: OrganizationPermissions.MembersRead,
  });
  const canReadMembers = canReadMembersDecision.allowed;

  const canManageMembersDecision = await composition.authorizationService.can({
    userId: platformUser.id,
    organizationId: organizationId as OrganizationId,
    permission: OrganizationPermissions.MembersUpdate,
  });
  const canManageMembers = canManageMembersDecision.allowed;

  let members: any[] = [];
  if (canReadMembers) {
    const membersRes = await composition.getOrganizationMembers(
      { organizationId, callerUserId: platformUser.id },
      composition.getOrganizationMembersDeps,
    );
    if (membersRes.ok) {
      members = [...membersRes.value.members];
    }
  }

  const activeMembership = await composition.membershipRepository.findForUserAndOrganization(
    organizationId as OrganizationId,
    platformUser.id,
  );

  return (
    <main style={{ maxWidth: "800px", margin: "60px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ marginBottom: "2rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "1rem" }}>
        <a href="/admin" style={{ color: "#2563eb", textDecoration: "none", fontSize: "0.875rem" }}>
          &larr; Back to Admin Overview
        </a>
        <h1 style={{ fontSize: "1.75rem", marginTop: "0.5rem" }} data-testid="org-heading">
          Organization: {organization ? organization.name : organizationId}
        </h1>
        <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
          Slug: {organization?.slug ?? "N/A"} | ID: {organizationId}
        </p>
      </header>

      <section style={{ marginBottom: "2rem", padding: "1.25rem", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>Your Access Context</h2>
        <p style={{ fontSize: "0.875rem", color: "#374151" }}>
          <strong>Signed in as:</strong> {platformUser.displayName} ({platformUser.email})
        </p>
        <p style={{ fontSize: "0.875rem", color: "#374151" }} data-testid="user-role">
          <strong>Your Role:</strong> {activeMembership?.role ?? "Platform Super Admin"}
        </p>
        <p style={{ fontSize: "0.875rem", color: "#374151" }}>
          <strong>Scope:</strong> {activeMembership?.websiteScopeId ? `Website: ${activeMembership.websiteScopeId}` : "Organization-Wide"}
        </p>
      </section>

      {canReadMembers && (
        <section style={{ marginBottom: "2rem", padding: "1.25rem", background: "#ffffff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.125rem" }}>Organization Members ({members.length})</h2>
            {canManageMembers && (
              <button
                data-testid="btn-add-member"
                style={{
                  padding: "6px 12px",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                + Add Member
              </button>
            )}
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
                <th style={{ padding: "8px" }}>User ID</th>
                <th style={{ padding: "8px" }}>Role</th>
                <th style={{ padding: "8px" }}>Scope</th>
                <th style={{ padding: "8px" }}>Status</th>
                {canManageMembers && <th style={{ padding: "8px" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid #f3f4f6" }} data-testid={`member-row-${m.userId}`}>
                  <td style={{ padding: "8px" }}>{m.userId}</td>
                  <td style={{ padding: "8px" }}>{m.role}</td>
                  <td style={{ padding: "8px" }}>{m.websiteScopeId ?? "Organization"}</td>
                  <td style={{ padding: "8px" }}>{m.status}</td>
                  {canManageMembers && (
                    <td style={{ padding: "8px" }}>
                      <span data-testid={`manage-member-${m.userId}`} style={{ color: "#2563eb", cursor: "pointer" }}>
                        Manage
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
