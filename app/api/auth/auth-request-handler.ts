import type { BetterAuthInstance } from "@livingsites/infrastructure";

export function createAuthRequestHandler(
  getAuth: () => BetterAuthInstance,
  getTrustedOrigins: () => readonly string[],
) {
  return async function handleAuthRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");

    if (request.method !== "GET" && origin && !getTrustedOrigins().includes(origin)) {
      return Response.json({ error: "Untrusted origin." }, { status: 403 });
    }

    if (url.pathname.endsWith("/sign-up/email") && request.method === "POST") {
      return Response.json(
        { error: "Direct sign-up is not allowed. Use /register." },
        { status: 403 },
      );
    }

    return getAuth().handler(request);
  };
}
