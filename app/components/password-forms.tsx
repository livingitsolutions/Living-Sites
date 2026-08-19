"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  changePasswordAction,
  forgotPasswordAction,
  resetPasswordAction,
} from "@/app/lib/password-actions";
import {
  initialPasswordFormState,
  type PasswordFormState,
} from "@/app/lib/password-workflows";

function FormMessage({ state }: { state: PasswordFormState }) {
  if (state.status === "idle" || !state.message) return null;
  return <p className={`auth-message auth-message-${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>;
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initialPasswordFormState);
  return <form action={action} className="auth-form">
    <FormMessage state={state} />
    <label className="auth-field" htmlFor="email">Email address<input id="email" name="email" type="email" autoComplete="email" required /></label>
    <button className="auth-submit" disabled={pending} type="submit">{pending ? "Preparing recovery…" : "Request reset link"}</button>
  </form>;
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialPasswordFormState);
  if (state.status === "success") return <div className="auth-success-panel"><p>{state.message}</p><Link href="/login">Return to sign in</Link></div>;
  return <form action={action} className="auth-form">
    <input type="hidden" name="token" value={token} />
    <FormMessage state={state} />
    <label className="auth-field" htmlFor="newPassword">New password<input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
    <label className="auth-field" htmlFor="confirmPassword">Confirm new password<input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
    <p className="auth-hint">Use 12–256 characters. The link expires after one hour and works once.</p>
    <button className="auth-submit" disabled={pending} type="submit">{pending ? "Resetting password…" : "Set new password"}</button>
  </form>;
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initialPasswordFormState);
  return <form action={action} className="security-form">
    <FormMessage state={state} />
    <label className="auth-field" htmlFor="currentPassword">Current password<input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required /></label>
    <div className="security-password-grid">
      <label className="auth-field" htmlFor="newPassword">New password<input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
      <label className="auth-field" htmlFor="confirmPassword">Confirm password<input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
    </div>
    <label className="security-checkbox"><input name="revokeOtherSessions" type="checkbox" defaultChecked /><span><strong>Sign out other sessions</strong><small>Replaces this session securely and revokes every other active session.</small></span></label>
    <button className="button button-primary" disabled={pending} type="submit">{pending ? "Updating password…" : "Change password"}</button>
  </form>;
}
