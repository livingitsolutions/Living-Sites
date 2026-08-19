import Link from "next/link";
import { ResetPasswordForm } from "@/app/components/password-forms";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = "", error } = await searchParams;
  const invalid = error === "INVALID_TOKEN" || !token;
  return <main className="auth-page"><section className="auth-panel"><div className="auth-brand"><span>LS</span><p>Living Sites</p></div><p className="auth-eyebrow">Credential recovery</p><h1>Choose a new password</h1>{invalid ? <div className="auth-message auth-message-error" role="alert">This reset link is invalid or has expired.</div> : <ResetPasswordForm token={token} />}<Link className="auth-back-link" href="/forgot-password">Request another reset link</Link></section><aside className="auth-aside"><p>One-time recovery</p><h2>A successful reset revokes every active session.</h2><span>Sign in again after choosing your new password.</span></aside></main>;
}
