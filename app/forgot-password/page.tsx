import Link from "next/link";
import { ForgotPasswordForm } from "@/app/components/password-forms";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return <main className="auth-page"><section className="auth-panel"><div className="auth-brand"><span>LS</span><p>Living Sites</p></div><p className="auth-eyebrow">Account recovery</p><h1>Reset your password</h1><p className="auth-intro">Enter your account email. For privacy, the response is the same whether or not the address exists.</p><ForgotPasswordForm /><Link className="auth-back-link" href="/login">Back to sign in</Link></section><aside className="auth-aside"><p>Secure by design</p><h2>Recovery links expire quickly and can only be used once.</h2><span>No account details are disclosed during recovery.</span></aside></main>;
}
