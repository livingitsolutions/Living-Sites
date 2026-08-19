import type { Config } from "@netlify/functions";
import { composeProductionFromEnvironment } from "../../packages/composition/src/production";

export default async function reconcileIdentityLinkages() {
  const composition = composeProductionFromEnvironment();
  try {
    const result = await composition.linkageReconciler.reconcile();
    composition.logger.info("Identity linkage reconciliation completed", result);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    composition.logger.error("Identity linkage reconciliation failed", {
      errorType: error instanceof Error ? error.name : "Unknown",
    });
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  } finally {
    await composition.close();
  }
}

export const config: Config = {
  schedule: "*/5 * * * *",
};
