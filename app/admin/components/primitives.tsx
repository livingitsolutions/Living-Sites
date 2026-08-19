import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h1>{title}</h1>{description ? <p>{description}</p> : null}</div>{action ? <div className="page-header-action">{action}</div> : null}</header>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`.trim()}>{children}</section>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <Card className="empty-state"><span className="empty-state-mark" aria-hidden="true" /><h2>{title}</h2><p>{description}</p>{action}</Card>;
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>;
}

export function FormField({ label, name, hint, error, children }: { label: string; name: string; hint?: string; error?: string; children: ReactNode }) {
  return <div className="form-field"><label htmlFor={name}>{label}</label>{children}{hint ? <p className="field-hint">{hint}</p> : null}{error ? <p className="field-error" id={`${name}-error`}>{error}</p> : null}</div>;
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return <div className="error-message" role="alert">{children}</div>;
}

export function AccessDenied({ reason = "You do not have permission to access this organization." }: { reason?: string }) {
  return <main className="centered-state"><p className="eyebrow">Access denied</p><h1>Organization unavailable</h1><p data-testid="unauthorized">{reason}</p></main>;
}

export function ComingSoon({ module }: { module: string }) {
  return <><PageHeader eyebrow="Module" title={module} description="This workspace is part of the permanent admin shell." /><EmptyState title={`${module} is coming soon`} description="The navigation and authorization boundary are ready. Module functionality is intentionally deferred." /></>;
}
