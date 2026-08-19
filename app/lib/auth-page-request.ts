import type { BetterAuthInstance } from "@livingsites/infrastructure";

type AuthSession = Awaited<ReturnType<BetterAuthInstance["api"]["getSession"]>>;

export type AuthPageDecision =
  | { readonly kind: "redirect"; readonly location: "/admin" | "/login" }
  | { readonly kind: "render"; readonly session: NonNullable<AuthSession> | null; readonly registrationMode?: string };

export async function evaluateAuthPageRequest(
  request: Request,
  auth: BetterAuthInstance,
  registrationMode = "invite_only",
): Promise<AuthPageDecision> {
  const session = await auth.api.getSession({ headers: request.headers });
  const pathname = new URL(request.url).pathname;

  if (pathname === "/admin") {
    return session
      ? { kind: "render", session }
      : { kind: "redirect", location: "/login" };
  }

  if (pathname === "/login" || pathname === "/register") {
    if (session) return { kind: "redirect", location: "/admin" };
    return pathname === "/register"
      ? { kind: "render", session: null, registrationMode }
      : { kind: "render", session: null };
  }

  throw new Error(`Unsupported auth page path: ${pathname}`);
}

export function authPageRequest(pathname: "/login" | "/register" | "/admin", requestHeaders: Headers): Request {
  const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return new Request(new URL(pathname, baseURL), { headers: requestHeaders });
}
