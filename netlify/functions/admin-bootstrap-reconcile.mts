import { timingSafeEqual } from "node:crypto";
import type { Config, Context } from "@netlify/functions";
import {
  AdminBootstrapError,
  composeProductionFromEnvironment,
  reconcileProductionAdministrator,
} from "@livingsites/composition";
import type { AdminBootstrapInput, AdminBootstrapStatus } from "@livingsites/composition";

const DEFAULT_ORGANIZATION_NAME = "Living IT Solutions";
const DEFAULT_ORGANIZATION_SLUG = "living-it-solutions";
const MAX_BODY_BYTES = 8192;
const ALLOWED_BODY_KEYS = new Set(["email", "displayName", "organizationName", "organizationSlug"]);

interface RequestBody {
  readonly email?: unknown;
  readonly displayName?: unknown;
  readonly organizationName?: unknown;
  readonly organizationSlug?: unknown;
}

interface HandlerDependencies {
  readonly getEnvironment: (key: string) => string | undefined;
  readonly reconcile: (input: AdminBootstrapInput) => Promise<AdminBootstrapStatus>;
}

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function authorized(request: Request, expectedToken: string): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const suppliedToken = header.slice("Bearer ".length);
  const supplied = Buffer.from(suppliedToken);
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string.`);
  return value.trim();
}

async function parseInput(request: Request): Promise<AdminBootstrapInput> {
  const contentLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) throw new Error("Request body is too large.");

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) throw new Error("Request body is too large.");
  const body = raw ? JSON.parse(raw) as RequestBody & Record<string, unknown> : {};
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Request body must be a JSON object.");

  for (const key of Object.keys(body)) {
    if (!ALLOWED_BODY_KEYS.has(key)) throw new Error(`Unsupported request field: ${key}.`);
  }

  return {
    email: optionalString(body.email, "email") ?? "livingitsolutions@gmail.com",
    displayName: optionalString(body.displayName, "displayName"),
    organizationName: optionalString(body.organizationName, "organizationName") ?? DEFAULT_ORGANIZATION_NAME,
    organizationSlug: optionalString(body.organizationSlug, "organizationSlug") ?? DEFAULT_ORGANIZATION_SLUG,
    createdBy: "production_bootstrap_function",
  };
}

function defaultDependencies(): HandlerDependencies {
  return {
    getEnvironment(key) {
      return Netlify.env.get(key);
    },
    async reconcile(input) {
      const composition = composeProductionFromEnvironment();
      try {
        return await reconcileProductionAdministrator(input, composition);
      } finally {
        await composition.close();
      }
    },
  };
}

export function createAdminBootstrapHandler(
  dependencies: HandlerDependencies = defaultDependencies(),
): (request: Request, context: Context) => Promise<Response> {
  return async function adminBootstrapHandler(request: Request, context: Context): Promise<Response> {
    if (request.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
    if (context.deploy.context !== "production") {
      return json(403, { ok: false, error: "production_runtime_required" });
    }

    const token = dependencies.getEnvironment("ADMIN_BOOTSTRAP_TOKEN");
    if (!token || token.length < 32 || !authorized(request, token)) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    let input: AdminBootstrapInput;
    try {
      input = await parseInput(request);
    } catch {
      return json(400, { ok: false, error: "invalid_request" });
    }

    try {
      const status = await dependencies.reconcile(input);
      return json(200, { ok: true, ...status, removeBootstrapToken: true });
    } catch (error) {
      if (error instanceof AdminBootstrapError) {
        const status = error.code === "invalid_input" ? 400
          : error.code === "identity_missing" || error.code === "bootstrap_locked" ? 409
            : 500;
        return json(status, { ok: false, error: error.code });
      }
      return json(500, { ok: false, error: "reconciliation_failed" });
    }
  };
}

export default createAdminBootstrapHandler();

export const config: Config = {
  method: "POST",
};
