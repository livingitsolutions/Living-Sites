import { getAuth } from "@/app/lib/auth";
import { createAuthRequestHandler } from "../auth-request-handler";

const handle = createAuthRequestHandler(getAuth, () =>
  (process.env.TRUSTED_ORIGINS ?? process.env.BETTER_AUTH_URL ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

export const GET = handle;
export const POST = handle;
