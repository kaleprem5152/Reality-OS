import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, reports } from "@/db/schema";
import { memoryStore } from "@/lib/memory-store";
import { rowToProject } from "../route";
import type { Project } from "@/lib/types";
import {
  authenticateApiRequest,
  canDeleteRecord,
  canWrite,
  createApiAuthErrorResponse,
  jsonForbidden,
  jsonInternalError,
  jsonNotFound,
} from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authenticateApiRequest(req);
  const authError = createApiAuthErrorResponse(auth);
  if (authError) return authError;

  // Sandbox demo sessions to memory store; never access PostgreSQL
  if (auth.status === "demo") {
    const p = memoryStore.getProject(id);
    if (!p) return jsonNotFound("Project not found");
    return NextResponse.json(p);
  }

  if (auth.status !== "authenticated") {
    return jsonInternalError("Unexpected authentication state.");
  }

  if (!db) {
    return jsonInternalError("Database connection is not configured.");
  }

  try {
    const rows = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, id),
          eq(projects.workspaceId, auth.workspace.workspaceId)
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return jsonNotFound("Project not found");
    }

    return NextResponse.json(rowToProject(rows[0]));
  } catch (err) {
    console.error("Failed to fetch project:", err);
    return jsonInternalError("Failed to fetch project.");
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authenticateApiRequest(req);
  const authError = createApiAuthErrorResponse(auth);
  if (authError) return authError;

  // Sandbox demo sessions strictly to memory store
  if (auth.status === "demo") {
    const existing = memoryStore.getProject(id);
    if (!existing) return jsonNotFound("Project not found");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const patch: Partial<Project> = {};
    if (typeof b.name === "string") {
      if (b.name.trim().length < 3) {
        return NextResponse.json({ error: "Project name is required (min 3 characters)." }, { status: 400 });
      }
      patch.name = b.name.trim();
    }
    if (typeof b.description === "string") patch.description = b.description;
    if (typeof b.infraType === "string") patch.infraType = b.infraType as Project["infraType"];
    if (typeof b.region === "string") patch.region = b.region;
    if (typeof b.status === "string") patch.status = b.status as Project["status"];
    if (typeof b.targetCompletion === "string") patch.targetCompletion = b.targetCompletion;
    if (typeof b.riskLevel === "string") patch.riskLevel = b.riskLevel as Project["riskLevel"];
    if (typeof b.capacityTarget === "string") patch.capacityTarget = b.capacityTarget;
    if (typeof b.requirements === "string") patch.requirements = b.requirements;
    if (typeof b.archived === "boolean") {
      patch.archived = b.archived;
      if (b.archived) {
        patch.status = "Archived";
      } else if (typeof b.status !== "string") {
        patch.status = "Planning";
      }
    }
    if (b.budgetCrore !== undefined) {
      const num = Number(b.budgetCrore);
      if (!Number.isFinite(num) || num <= 0) {
        return NextResponse.json({ error: "Estimated budget must be a positive number." }, { status: 400 });
      }
      patch.budgetCrore = num;
    }
    if (Array.isArray(b.sustainabilityPriorities)) {
      patch.sustainabilityPriorities = b.sustainabilityPriorities.filter(
        (x: unknown) => typeof x === "string",
      );
    }
    if (b.stations !== undefined) {
      patch.stations = b.stations === null ? null : Number(b.stations);
    }
    if (b.corridorKm !== undefined) {
      patch.corridorKm = b.corridorKm === null ? null : Number(b.corridorKm);
    }

    const updated = memoryStore.updateProject(id, patch);
    if (!updated) return jsonNotFound("Project not found");
    return NextResponse.json(updated);
  }

  if (auth.status !== "authenticated") {
    return jsonInternalError("Unexpected authentication state.");
  }

  if (!db) {
    return jsonInternalError("Database connection is not configured.");
  }

  try {
    // 1. Look up resource scoped by ID and workspace ID
    // Return 404 if not found in caller's workspace, including IDs belonging to another workspace.
    const existingRows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, id),
          eq(projects.workspaceId, auth.workspace.workspaceId)
        )
      )
      .limit(1);

    if (existingRows.length === 0) {
      return jsonNotFound("Project not found");
    }

    // 2. Enforce authorization before mutation
    // Viewer role cannot update projects -> 403
    if (!canWrite(auth)) {
      return jsonForbidden("Insufficient permissions to update projects in this workspace.");
    }

    // 3. Parse and validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const b = body as Record<string, unknown>;

    // Whitelist patch properties: ignore client-sent workspaceId, createdBy, id, etc.
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof b.name === "string") {
      if (b.name.trim().length < 3) {
        return NextResponse.json({ error: "Project name is required (min 3 characters)." }, { status: 400 });
      }
      patch.name = b.name.trim();
    }
    if (typeof b.description === "string") patch.description = b.description;
    if (typeof b.infraType === "string") patch.infraType = b.infraType;
    if (typeof b.region === "string") patch.region = b.region;
    if (typeof b.status === "string") patch.status = b.status;
    if (typeof b.targetCompletion === "string") patch.targetCompletion = b.targetCompletion;
    if (typeof b.riskLevel === "string") patch.riskLevel = b.riskLevel;
    if (typeof b.capacityTarget === "string") patch.capacityTarget = b.capacityTarget;
    if (typeof b.requirements === "string") patch.requirements = b.requirements;
    if (typeof b.archived === "boolean") {
      patch.archived = b.archived;
      if (b.archived) {
        patch.status = "Archived";
      } else if (typeof b.status !== "string") {
        patch.status = "Planning";
      }
    }
    if (b.budgetCrore !== undefined) {
      const num = Number(b.budgetCrore);
      if (!Number.isFinite(num) || num <= 0) {
        return NextResponse.json({ error: "Estimated budget must be a positive number." }, { status: 400 });
      }
      patch.budgetCrore = num;
    }
    if (Array.isArray(b.sustainabilityPriorities)) {
      patch.sustainabilityPriorities = b.sustainabilityPriorities.filter(
        (x: unknown) => typeof x === "string",
      );
    }
    if (b.stations !== undefined) {
      patch.stations = b.stations === null ? null : Number(b.stations);
    }
    if (b.corridorKm !== undefined) {
      patch.corridorKm = b.corridorKm === null ? null : Number(b.corridorKm);
    }

    // 4. Update scoped strictly to ID and authenticated workspace ID
    const [row] = await db
      .update(projects)
      .set(patch)
      .where(
        and(
          eq(projects.id, id),
          eq(projects.workspaceId, auth.workspace.workspaceId)
        )
      )
      .returning();

    if (!row) {
      return jsonNotFound("Project not found");
    }

    return NextResponse.json(rowToProject(row));
  } catch (err) {
    console.error("Failed to update project:", err);
    return jsonInternalError("Failed to update project.");
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authenticateApiRequest(req);
  const authError = createApiAuthErrorResponse(auth);
  if (authError) return authError;

  // Sandbox demo sessions strictly to memory store
  if (auth.status === "demo") {
    const ok = memoryStore.deleteProject(id);
    if (!ok) return jsonNotFound("Project not found");
    return NextResponse.json({ ok: true });
  }

  if (auth.status !== "authenticated") {
    return jsonInternalError("Unexpected authentication state.");
  }

  if (!db) {
    return jsonInternalError("Database connection is not configured.");
  }

  try {
    // 1. Look up project scoped by id AND workspaceId
    // Returns 404 if not found in caller's workspace, including IDs belonging to another workspace.
    const existing = await db
      .select({
        id: projects.id,
        createdBy: projects.createdBy,
      })
      .from(projects)
      .where(
        and(
          eq(projects.id, id),
          eq(projects.workspaceId, auth.workspace.workspaceId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return jsonNotFound("Project not found");
    }

    const targetProject = existing[0];

    // 2. Check authorization before mutation
    // Admin/owner: may delete any project in their workspace.
    // Editor: may delete ONLY records whose created_by matches their verified Supabase user ID.
    // Viewer: cannot delete -> 403.
    if (!canDeleteRecord(auth, targetProject.createdBy)) {
      return jsonForbidden("Insufficient permissions to delete this project.");
    }

    // 3. Delete associated reports scoped by projectId AND workspaceId to prevent cross-workspace impact
    await db
      .delete(reports)
      .where(
        and(
          eq(reports.projectId, id),
          eq(reports.workspaceId, auth.workspace.workspaceId)
        )
      );

    // 4. Delete project scoped by id AND workspaceId
    const deleted = await db
      .delete(projects)
      .where(
        and(
          eq(projects.id, id),
          eq(projects.workspaceId, auth.workspace.workspaceId)
        )
      )
      .returning({ id: projects.id });

    if (deleted.length === 0) {
      return jsonNotFound("Project not found");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete project:", err);
    return jsonInternalError("Failed to delete project.");
  }
}
