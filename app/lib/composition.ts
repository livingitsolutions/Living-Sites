/**
 * Canonical Better Auth instance — server-only.
 *
 * This module creates exactly ONE Better Auth instance using:
 * - Netlify Database (via the composition root)
 * - Drizzle adapter
 * - BETTER_AUTH_SECRET
 * - BETTER_AUTH_URL
 * - trusted origins
 * - email/password auth
 * - session configuration
 * - email verification
 *
 * All auth paths use this same instance:
 * - /api/auth/[...all] route handler
 * - registration (via registerUser use case)
 * - sign-in, sign-out
 * - server session lookup
 * - protected /admin
 *
 * No placeholder wiring. No `null as any`. No second auth instance.
 */
import "server-only";
import { composeProductionFromEnvironment } from "@livingsites/composition";
import type { ProductionComposition } from "@livingsites/composition";

let composition: ProductionComposition | null = null;

export function getComposition(): ProductionComposition {
  if (!composition) {
    composition = composeProductionFromEnvironment();
  }
  return composition;
}
