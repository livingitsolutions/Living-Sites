/**
 * Drizzle schema for the organizations table.
 *
 * Internal to Infrastructure. Row types are NOT exported from the
 * Infrastructure public barrel — they stay private to the Drizzle adapter.
 */
import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const orgStatusEnum = pgEnum("org_status", ["active", "archived", "deleted"]);

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  billing_email: text("billing_email").notNull(),
  plan_id: text("plan_id"),
  status: orgStatusEnum("status").notNull().default("active"),
  feature_overrides: text("feature_overrides").notNull().default("[]"),
  version: integer("version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull(),
  created_by: text("created_by"),
  updated_by: text("updated_by"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
});

type OrganizationRow = typeof organizations.$inferSelect;
type OrganizationInsert = typeof organizations.$inferInsert;

export type { OrganizationRow, OrganizationInsert };
