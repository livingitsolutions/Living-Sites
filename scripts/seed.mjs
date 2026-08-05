#!/usr/bin/env node
/**
 * Seed script — seeds platform-global Plans and Features.
 *
 * Usage: DATABASE_URL=postgresql://... npm run db:seed
 *
 * Seeds are idempotent: rerunning does not create duplicates.
 * Seeds must never run automatically at application startup.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../packages/infrastructure/src/db/schema.ts";
import { seedPlansAndFeatures } from "../packages/infrastructure/src/db/seed.ts";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Set it to a PostgreSQL connection string.");
  process.exit(1);
}

const sqlClient = postgres(DATABASE_URL);
const db = drizzle(sqlClient, { schema });

try {
  console.log("Seeding plans and features...");
  const result = await seedPlansAndFeatures(db);
  console.log(`Seed complete: ${result.plansInserted} plans, ${result.featuresInserted} features, ${result.entitlementsInserted} entitlements inserted.`);
} catch (err) {
  console.error("Seed failed:", err);
  process.exit(1);
} finally {
  await sqlClient.end();
}
