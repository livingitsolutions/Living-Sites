import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthSubjectId, OrganizationId } from "@livingsites/domain";
import { authPageRequest, evaluateAuthPageRequest } from "@/app/lib/auth-page-request";
import { getAuth } from "@/app/lib/auth";
import { getComposition } from "@/app/lib/composition";

export const dynamic = "force-dynamic";

export default async function OrganizationWebsitesPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const composition = getComposition();
  const decision = await evaluateAuthPageRequest(
    authPageRequest(`/admin/organizations/${organizationId}/websites`, await headers()),
    getAuth(),
  );
  if (decision.kind === "redirect") redirect(decision.location);

  const sessionUser = decision.session!.user;
  let platformUser = await composition.userReader.findByAuthSubjectId(sessionUser.id as AuthSubjectId);
  if (!platformUser && sessionUser.email) platformUser = await composition.userReader.findByEmail(sessionUser.email);
  if (!platformUser) return <AccessDenied />;

  const result = await composition.listOrganizationWebsites(
    { organizationId: organizationId as OrganizationId },
    { authenticatedUser: { userId: platformUser.id }, authorizationService: composition.authorizationService, websiteReader: composition.websiteRepository },
  );
  if (!result.ok) return <AccessDenied />;

  return (
    <main style={{ minHeight: "100vh", background: "#f3f0e8", color: "#242820", padding: "64px 24px", fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <a href={`/admin/organizations/${organizationId}`} style={{ color: "#506247", fontFamily: "ui-monospace, monospace", fontSize: 13, letterSpacing: "0.04em" }}>← Organization</a>
        <header style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "end", borderBottom: "2px solid #242820", padding: "32px 0 20px" }}>
          <div>
            <p style={{ margin: 0, color: "#6b7565", fontFamily: "ui-monospace, monospace", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>Website registry</p>
            <h1 style={{ margin: "8px 0 0", fontSize: "clamp(36px, 7vw, 72px)", fontWeight: 400, lineHeight: 0.95 }}>Published places begin here.</h1>
          </div>
          <strong data-testid="website-count" style={{ fontSize: 48, fontWeight: 400 }}>{result.value.length}</strong>
        </header>

        {result.value.length === 0 ? (
          <section data-testid="website-empty-state" style={{ marginTop: 28, border: "1px solid #9ba491", padding: 28, background: "#ebe7dc" }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 400 }}>No websites yet</h2>
            <p style={{ margin: "8px 0 0", color: "#586052", fontFamily: "ui-monospace, monospace", fontSize: 13 }}>Creation is available through the application use case; the CMS interface arrives later.</p>
          </section>
        ) : (
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {result.value.map((website, index) => (
              <li key={website.id} data-testid={`website-${website.id}`} style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 20, alignItems: "center", borderBottom: "1px solid #aeb5a7", padding: "24px 0" }}>
                <span style={{ color: "#7c8575", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 27, fontWeight: 400 }}>{website.name}</h2>
                  <p style={{ margin: "6px 0 0", color: "#626b5c", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{website.fallbackDomain}</p>
                </div>
                <span style={{ border: "1px solid #737d6c", borderRadius: 999, padding: "6px 10px", fontFamily: "ui-monospace, monospace", fontSize: 11, textTransform: "uppercase" }}>{website.status}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}

function AccessDenied() {
  return <main style={{ padding: 64 }}><h1 data-testid="unauthorized">403 Forbidden</h1><p>Website access is not permitted for this organization.</p></main>;
}
