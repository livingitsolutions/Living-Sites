import type { Page } from "@livingsites/domain";
import Link from "next/link";
import { Card, EmptyState, StatusBadge } from "../../../../../components/primitives";
import type { PageActionState } from "./page-state";
import { CreatePageForm, EditPageForm } from "./page-forms";

const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
export function PagesView({ pages, canCreate, canUpdate, canArchive, createAction, updateAction, archiveAction, restoreAction }: { pages: readonly Page[]; canCreate: boolean; canUpdate: boolean; canArchive: boolean; createAction: (state: PageActionState, formData: FormData) => Promise<PageActionState>; updateAction: (state: PageActionState, formData: FormData) => Promise<PageActionState>; archiveAction: (formData: FormData) => Promise<void>; restoreAction: (formData: FormData) => Promise<void> }) {
  if (!pages.length) return <EmptyState title="Create your first Page" description={canCreate ? "Start with a draft Page, then shape it in the visual builder." : "No Pages exist in this Website yet."} action={canCreate ? <CreatePageForm action={createAction} /> : null} />;
  return <div className="page-list" data-testid="page-list">{pages.map((page) => <Card key={page.id} className="page-row"><div><div className="page-title-line"><h2>{page.title}</h2><StatusBadge status={page.status} /></div><p className="page-slug">/{page.slug}</p><small>Updated {formatDate(page.audit.updatedAt)}</small></div><div className="page-actions">{page.status === "draft" ? <Link className="button button-primary" href={`pages/${page.id}/builder`}>{canUpdate ? "Build page" : "Preview"}</Link> : null}{canUpdate && page.status !== "archived" ? <EditPageForm page={page} action={updateAction} /> : null}{canArchive ? <form action={page.status === "archived" ? restoreAction : archiveAction}><input type="hidden" name="pageId" value={page.id} /><input type="hidden" name="version" value={page.version} /><button className="button button-secondary">{page.status === "archived" ? "Restore" : "Archive"}</button></form> : null}</div></Card>)}</div>;
}
