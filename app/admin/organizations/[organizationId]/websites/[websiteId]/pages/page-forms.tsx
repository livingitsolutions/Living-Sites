"use client";

import { useActionState, useEffect, useRef } from "react";
import { ErrorMessage, FormField } from "../../../../../components/primitives";
import { initialPageActionState, type PageActionState } from "./page-state";

export function CreatePageForm({ action }: { action: (state: PageActionState, formData: FormData) => Promise<PageActionState> }) {
  const [state, formAction, pending] = useActionState(action, initialPageActionState); const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") ref.current?.reset(); }, [state.status]);
  return <details className="create-panel" open={state.status === "error"}><summary className="button button-primary">Create Page</summary><div className="create-panel-body"><div><p className="eyebrow">New draft</p><h2>Create a Page</h2><p>Set the address and title. Content editing arrives with the Page Builder.</p></div><form ref={ref} action={formAction} className="create-form">{state.status === "error" && state.message ? <ErrorMessage>{state.message}</ErrorMessage> : null}<FormField label="Page title" name="title" error={state.fieldErrors?.title}><input id="title" name="title" required maxLength={200} /></FormField><FormField label="Slug" name="slug" hint="Nested paths such as services/remodel are supported." error={state.fieldErrors?.slug}><div className="slug-input"><span>/</span><input id="slug" name="slug" required maxLength={200} /></div></FormField><FormField label="Description" name="description"><input id="description" name="description" maxLength={300} /></FormField><button className="button button-primary" disabled={pending}>{pending ? "Creating…" : "Create draft"}</button></form></div></details>;
}

export function EditPageForm({ page, action }: { page: { id: string; title: string; slug: string; description?: string; version: number }; action: (state: PageActionState, formData: FormData) => Promise<PageActionState> }) {
  const [state, formAction, pending] = useActionState(action, initialPageActionState);
  return <details className="page-edit"><summary className="text-button">Edit details</summary><form action={formAction} className="inline-page-form"><input type="hidden" name="pageId" value={page.id} /><input type="hidden" name="version" value={page.version} />{state.status === "error" && state.message ? <ErrorMessage>{state.message}</ErrorMessage> : null}<FormField label="Title" name={`title-${page.id}`}><input id={`title-${page.id}`} name="title" defaultValue={page.title} required /></FormField><FormField label="Slug" name={`slug-${page.id}`}><input id={`slug-${page.id}`} name="slug" defaultValue={page.slug} required /></FormField><input type="hidden" name="description" value={page.description ?? ""} /><button className="button button-secondary" disabled={pending}>{pending ? "Saving…" : "Save"}</button></form></details>;
}
