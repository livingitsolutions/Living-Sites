import type { BetterAuthInstance } from "@livingsites/infrastructure";

export function createAuthRequestHandler(
  getAuth: () => BetterAuthInstance,
  getTrustedOrigins: () => readonly string[],
) {
  return async function handleAuthRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const isBrowserForm = request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded") ?? false;

    if (request.method !== "GET" && origin && !getTrustedOrigins().includes(origin)) {
      return Response.json({ error: "Untrusted origin." }, { status: 403 });
    }

    if (url.pathname.endsWith("/sign-up/email") && request.method === "POST") {
      return Response.json(
        { error: "Direct sign-up is not allowed. Use /register." },
        { status: 403 },
      );
    }

    const response = await getAuth().handler(request);

    if (isBrowserForm && (url.pathname.endsWith("/sign-in/email") || url.pathname.endsWith("/sign-out"))) {
      const destination = response.ok
        ? (url.pathname.endsWith("/sign-out") ? "/login" : "/admin")
        : (url.pathname.endsWith("/sign-out") ? "/login" : "/login?error=invalid_credentials");
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.delete("content-type");
      headers.set("location", destination);
      return new Response(null, { status: 303, headers });
    }

    return response;
  };
}
