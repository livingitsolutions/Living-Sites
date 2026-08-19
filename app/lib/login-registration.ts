export type LoginRegistrationContent =
  | { readonly kind: "message"; readonly text: string }
  | { readonly kind: "link"; readonly text: string; readonly href: "/register" };

export function loginRegistrationContent(mode: string): LoginRegistrationContent {
  if (mode === "disabled") {
    return { kind: "message", text: "Registration is currently disabled. Contact your platform administrator for access." };
  }
  if (mode === "invite_only") return { kind: "message", text: "Access is invitation-only." };
  return { kind: "link", text: "Create an account", href: "/register" };
}
