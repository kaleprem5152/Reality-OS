import {
  boolean,
  check,
  doublePrecision,
  index,
  jsonb,
  pgSchema,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * RealityOS persistence schema.
 * Shared workspaces, RBAC memberships, invitations, projects, reports, and profiles.
 */

/**
 * Supabase Auth Schema mapping.
 * Canonical user reference pointing to auth.users(id).
 */
export const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

/**
 * 1. Profiles table linked to Supabase Auth.
 * Holds user profile fields (job title/planning discipline is distinct from workspace roles).
 */
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  fullName: text("full_name"),
  organization: text("organization").default("Metropolitan Authority"),
  role: text("role").default("Lead Infrastructure Planner"), // Job title / discipline
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * 2. Workspaces table.
 * Core entity for team collaboration and data isolation.
 */
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workspaces_created_by_idx").on(table.createdBy),
  ]
);

/**
 * 3. Workspace members table.
 * Workspace authorization roles: 'owner' | 'admin' | 'editor' | 'viewer'.
 */
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("workspace_members_ws_user_unique").on(table.workspaceId, table.userId),
    index("workspace_members_user_idx").on(table.userId),
    index("workspace_members_ws_role_idx").on(table.workspaceId, table.role),
    check(
      "workspace_members_role_check",
      sql`${table.role} in ('owner', 'admin', 'editor', 'viewer')`
    ),
  ]
);

/**
 * 4. Workspace invitations table.
 * Non-reversible SHA-256 token hash storage. Excludes 'owner' role.
 */
export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull(), // 'admin' | 'editor' | 'viewer'
    tokenHash: text("token_hash").notNull().unique(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workspace_invitations_ws_email_idx").on(table.workspaceId, table.email),
    index("workspace_invitations_expires_idx").on(table.expiresAt),
    check(
      "workspace_invitations_role_check",
      sql`${table.role} in ('admin', 'editor', 'viewer')`
    ),
    check(
      "workspace_invitations_status_check",
      sql`${table.status} in ('pending', 'accepted', 'revoked', 'expired')`
    ),
  ]
);

/**
 * 5. Projects table.
 * Added nullable workspaceId and createdBy for backward compatibility and workspace isolation.
 */
export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(), // e.g. "PRJ-1001"
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
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
  },
  (table) => [
    index("projects_workspace_idx").on(table.workspaceId),
    index("projects_created_by_idx").on(table.createdBy),
  ]
);

/**
 * 6. Reports table.
 * Linked to parent project, with direct workspaceId for fast workspace-scoped RLS.
 */
export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey(), // e.g. "RPT-5001"
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    reportType: text("report_type").notNull(),
    status: text("status").notNull(), // Draft | Final
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("reports_workspace_idx").on(table.workspaceId),
    index("reports_project_idx").on(table.projectId),
    index("reports_created_by_idx").on(table.createdBy),
  ]
);

export type ProfileRow = typeof profiles.$inferSelect;
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type WorkspaceMemberRow = typeof workspaceMembers.$inferSelect;
export type WorkspaceInvitationRow = typeof workspaceInvitations.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";
export type InvitationRole = "admin" | "editor" | "viewer";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
