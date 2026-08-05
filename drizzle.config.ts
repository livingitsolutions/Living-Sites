import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./packages/infrastructure/src/db/schema.ts",
  out: "./packages/infrastructure/drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/living_sites",
  },
});
