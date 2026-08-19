"use client";

import { useActionState, useEffect, useRef } from "react";
import { ErrorMessage, FormField } from "../../../components/primitives";
import { initialCreateWebsiteState, type CreateWebsiteState } from "./create-website-state";

export function CreateWebsiteForm({ action }: { action: (state: CreateWebsiteState, formData: FormData) => Promise<CreateWebsiteState> }) {
  const [state, formAction, pending] = useActionState(action, initialCreateWebsiteState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return <details className="create-panel" open={state.status === "error"}>
    <summary className="button button-primary">Create Website</summary>
    <div className="create-panel-body">
      <div><p className="eyebrow">New Website</p><h2>Create a Website</h2><p>Start with a name and URL-safe slug. Domains and themes come later.</p></div>
      <form ref={formRef} action={formAction} className="create-form">
        {state.status === "error" && state.message ? <ErrorMessage>{state.message}</ErrorMessage> : null}
        {state.status === "success" && state.message ? <p className="success-message" role="status">{state.message}</p> : null}
        <FormField label="Website name" name="name" error={state.fieldErrors?.name}>
          <input id="name" name="name" required minLength={1} maxLength={200} autoComplete="off" aria-describedby={state.fieldErrors?.name ? "name-error" : undefined} />
        </FormField>
        <FormField label="Slug" name="slug" hint="Use lowercase letters, numbers, and single dashes." error={state.fieldErrors?.slug}>
          <div className="slug-input"><span aria-hidden="true">/</span><input id="slug" name="slug" required minLength={2} maxLength={63} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" autoCapitalize="none" spellCheck={false} aria-describedby={state.fieldErrors?.slug ? "slug-error" : undefined} /></div>
        </FormField>
        <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create Website"}</button>
      </form>
    </div>
  </details>;
}
