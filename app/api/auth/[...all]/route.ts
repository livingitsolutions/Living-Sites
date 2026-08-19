import { getAuth } from "@/app/lib/auth";
import { resolveTrustedOrigins } from "@livingsites/composition";
import { createAuthRequestHandler } from "../auth-request-handler";

const handle = createAuthRequestHandler(getAuth, () => {
  const betterAuthUrl = process.env.BETTER_AUTH_URL;
  return betterAuthUrl ? resolveTrustedOrigins(process.env, betterAuthUrl) : [];
});

export const GET = handle;
export const POST = handle;
