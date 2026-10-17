import {
  boolean,
  doublePrecision,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * RealityOS persistence schema.
 * Projects and reports are the only server-persisted entities.
 * Everything else (metro schematic, knowledge graph, scenarios)
 * is a typed, in-repo illustrative dataset.
 */
export const projects = pgTable("projects", {
  id: text("id").primaryKey(), // e.g. "PRJ-1001"
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  infraType: text("infra_type").notNull(),
  region: text("region").notNull(),
  status: text("status").notNull(),
  budgetCrore: doublePrecision("budget_crore").notNull(),
  targetCompletion: text("target_completion").notNull(),
  riskLevel: text("risk_level").notNull(),
  capacityTarget: text("capacity_target").notNull().default(""),
  sustainabilityPriorities: jsonb("sustainability_priorities")
    .$type<string[]>()
    .notNull()
    .default([]),
  requirements: text("requirements").notNull().default(""),
  stations: doublePrecision("stations"),
  corridorKm: doublePrecision("corridor_km"),
  featured: boolean("featured").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const reports = pgTable("reports", {
  id: text("id").primaryKey(), // e.g. "RPT-5001"
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  reportType: text("report_type").notNull(),
  status: text("status").notNull(), // Draft | Final
  content: jsonb("content").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ProjectRow = typeof projects.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;
