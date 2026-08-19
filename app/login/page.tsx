import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/app/lib/auth";
import { authPageRequest, evaluateAuthPageRequest } from "@/app/lib/auth-page-request";
import Link from "next/link";
import { loginRegistrationContent } from "@/app/lib/login-registration";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const auth = getAuth();
  const decision = await evaluateAuthPageRequest(authPageRequest("/login", await headers()), auth);

  if (decision.kind === "redirect") {
    redirect(decision.location);
  }

  const registrationMode = process.env.AUTH_REGISTRATION_MODE ?? "invite_only";
  const registration = loginRegistrationContent(registrationMode);
  return <main className="auth-page"><section className="auth-panel"><div className="auth-brand"><span>LS</span><p>Living Sites</p></div><p className="auth-eyebrow">Platform access</p><h1>Welcome back</h1><p className="auth-intro">Sign in to manage your organizations, websites, and publishing workspace.</p><form action="/api/auth/sign-in/email" method="POST" className="auth-form"><label className="auth-field">Email address<input type="email" name="email" autoComplete="email" required /></label><label className="auth-field">Password<input type="password" name="password" autoComplete="current-password" required /></label><div className="auth-form-meta"><Link href="/forgot-password">Forgot password?</Link></div><button className="auth-submit" type="submit">Sign in</button></form><p className="auth-registration-note">{registration.kind === "link" ? <>New to Living Sites? <Link href={registration.href}>{registration.text}</Link></> : registration.text}</p></section><aside className="auth-aside"><p>Living Sites CMS</p><h2>One calm workspace for every site you operate.</h2><span>Secure platform access for owners, editors, and administrators.</span></aside></main>;
}
