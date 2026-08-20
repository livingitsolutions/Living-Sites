"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PagePublicationHistoryItem } from "@livingsites/application";
import { rollbackPagePublicationAction } from "../actions";

export function HistoryClient({ organizationId, websiteId, pageId, pageVersion, history, canRollback }: { readonly organizationId: string; readonly websiteId: string; readonly pageId: string; readonly pageVersion: number; readonly history: readonly PagePublicationHistoryItem[]; readonly canRollback: boolean }) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const rollback = (revisionNumber: number) => {
    if (!window.confirm(`Rollback to revision ${revisionNumber}? This creates a new revision and keeps all historical revisions unchanged.`)) return;
    startTransition(async () => {
      setNotice(null);
      const result = await rollbackPagePublicationAction(organizationId, websiteId, pageId, revisionNumber, pageVersion);
      if (!result.ok) { setNotice(result.message); return; }
      setNotice(`Created revision ${result.revisionNumber} from revision ${revisionNumber}.`);
      router.refresh();
    });
  };

  return <section className="version-history-card">
    {notice ? <p className="version-history-notice" role="status">{notice}</p> : null}
    <div className="version-history-table" role="table" aria-label="Page publication history">
      <div className="version-history-row version-history-head" role="row"><span>Revision</span><span>Published</span><span>Release</span><span>Publisher</span><span>Actions</span></div>
      {history.map((item) => <div className="version-history-row" role="row" key={item.snapshotId}>
        <span><strong>#{item.revisionNumber}</strong>{item.isCurrent ? <em>Current</em> : null}</span>
        <span>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.publishedAt))}</span>
        <span>{item.releaseVersion ? String(item.releaseVersion) : "—"}</span>
        <span>{item.publishedBy || "—"}</span>
        <span className="version-history-actions"><a href={`history/${item.snapshotId}`}>Preview</a>{canRollback && !item.isCurrent ? <button type="button" disabled={pending} onClick={() => rollback(item.revisionNumber)}>Rollback</button> : null}</span>
      </div>)}
    </div>
  </section>;
}
