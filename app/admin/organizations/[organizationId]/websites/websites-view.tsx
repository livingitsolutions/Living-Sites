import type { Website } from "@livingsites/domain";
import Link from "next/link";
import { Card, EmptyState, StatusBadge } from "../../../components/primitives";
import { CreateWebsiteForm } from "./create-website-form";
import type { CreateWebsiteState } from "./create-website-state";

const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));

export function WebsitesView({ organizationId, websites, canCreate, createAction }: { organizationId: string; websites: readonly Website[]; canCreate: boolean; createAction?: (state: CreateWebsiteState, formData: FormData) => Promise<CreateWebsiteState> }) {
  if (websites.length === 0) return <EmptyState title="Create your first Website" description={canCreate ? "Add a Website to begin organizing content for this organization." : "No Websites have been created for this organization yet."} action={canCreate && createAction ? <CreateWebsiteForm action={createAction} /> : null} />;
  return <div className="website-list" data-testid="website-list">
    {websites.map((website) => <Card key={website.id} className="website-row">
      <div className="website-identity"><span className="website-monogram" aria-hidden="true">{website.name.slice(0, 1).toUpperCase()}</span><div><div className="website-title-line"><h2>{website.name}</h2><StatusBadge status={website.status} /></div><p>/{website.slug}</p></div></div>
      <div className="website-row-actions"><dl className="website-details"><div><dt>Domain</dt><dd>{website.customDomain ?? website.fallbackDomain}</dd></div><div><dt>Created</dt><dd>{formatDate(website.audit.createdAt)}</dd></div><div><dt>Updated</dt><dd>{formatDate(website.audit.updatedAt)}</dd></div></dl><Link className="button button-secondary" href={`/admin/organizations/${organizationId}/websites/${website.id}/pages`}>Open workspace</Link></div>
    </Card>)}
  </div>;
}
