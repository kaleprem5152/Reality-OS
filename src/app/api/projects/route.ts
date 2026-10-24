import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { memoryStore } from "@/lib/memory-store";
import type { Project } from "@/lib/types";
import {
  authenticateApiRequest,
  canWrite,
  createApiAuthErrorResponse,
  jsonForbidden,
  jsonInternalError,
} from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export function rowToProject(r: typeof projects.$inferSelect): Project {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    infraType: r.infraType as Project["infraType"],
    region: r.region,
    status: r.status as Project["status"],
    budgetCrore: r.budgetCrore,
    targetCompletion: r.targetCompletion,
    riskLevel: r.riskLevel as Project["riskLevel"],
    capacityTarget: r.capacityTarget,
    sustainabilityPriorities: r.sustainabilityPriorities ?? [],
    requirements: r.requirements,
    stations: r.stations,
    corridorKm: r.corridorKm,
    featured: r.featured,
    archived: r.archived,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  const authError = createApiAuthErrorResponse(auth);
  if (authError) return authError;

  // Sandbox demo sessions to memory store; never access PostgreSQL
  if (auth.status === "demo") {
    return NextResponse.json(memoryStore.getProjects());
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
      .where(eq(projects.workspaceId, auth.workspace.workspaceId))
      .orderBy(asc(projects.id));

    return NextResponse.json(rows.map(rowToProject));
  } catch (err) {
    console.error("Failed to fetch projects:", err);
    return jsonInternalError("Failed to fetch projects.");
  }
}

function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  const authError = createApiAuthErrorResponse(auth);
  if (authError) return authError;

  // Enforce mutation permissions: viewers cannot create projects
  if (!canWrite(auth)) {
    return jsonForbidden("Insufficient permissions to create projects in this workspace.");
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON request body.");
    }
    if (!body || typeof body !== "object") {
      return bad("Invalid request body.");
    }
    const b = body as Record<string, unknown>;

    const name = String(b.name ?? "").trim();
    const description = String(b.description ?? "").trim();
    const infraType = String(b.infraType ?? "").trim();
    const region = String(b.region ?? "").trim();
    const budget = Number(b.budgetCrore);
    if (!name || name.length < 3) return bad("Project name is required (min 3 characters).");
    if (!infraType) return bad("Infrastructure type is required.");
    if (!region) return bad("Geographic region is required.");
    if (!Number.isFinite(budget) || budget <= 0) return bad("Estimated budget must be a positive number.");
    const targetCompletion = String(b.targetCompletion ?? "").trim();
    if (!targetCompletion) return bad("Target completion is required.");

    // Sandbox demo sessions strictly to memory store
    if (auth.status === "demo") {
      const p = memoryStore.createProject({
        name,
        description,
        infraType: infraType as Project["infraType"],
        region,
        budgetCrore: budget,
        targetCompletion,
        riskLevel: (b.riskLevel as Project["riskLevel"]) || "Moderate",
        capacityTarget: String(b.capacityTarget ?? ""),
        sustainabilityPriorities: Array.isArray(b.sustainabilityPriorities)
          ? b.sustainabilityPriorities.filter((x: unknown) => typeof x === "string")
          : [],
        requirements: String(b.requirements ?? ""),
        stations: b.stations !== undefined && b.stations !== null ? Number(b.stations) : null,
        corridorKm: b.corridorKm !== undefined && b.corridorKm !== null ? Number(b.corridorKm) : null,
      });
      return NextResponse.json(p, { status: 201 });
    }

    if (auth.status !== "authenticated") {
      return jsonInternalError("Unexpected authentication state.");
    }

    if (!db) {
      return jsonInternalError("Database connection is not configured.");
    }

    // Determine sequential project ID
    const existing = await db.select({ id: projects.id }).from(projects);
    const maxNum = existing.reduce((m: number, row: { id: string }) => {
      const n = parseInt(row.id.replace(/\D/g, ""), 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 1000);
    const id = `PRJ-${maxNum + 1}`;

    const [row] = await db
      .insert(projects)
      .values({
        id,
        workspaceId: auth.workspace.workspaceId,
        createdBy: auth.user.id,
        name,
        description,
        infraType,
        region,
        status: "Planning",
        budgetCrore: budget,
        targetCompletion,
        riskLevel: (b.riskLevel as Project["riskLevel"]) || "Moderate",
        capacityTarget: String(b.capacityTarget ?? ""),
        sustainabilityPriorities: Array.isArray(b.sustainabilityPriorities)
          ? b.sustainabilityPriorities.filter((x: unknown) => typeof x === "string")
          : [],
        requirements: String(b.requirements ?? ""),
        stations: b.stations !== undefined && b.stations !== null ? Number(b.stations) : null,
        corridorKm: b.corridorKm !== undefined && b.corridorKm !== null ? Number(b.corridorKm) : null,
        featured: false,
        archived: false,
      })
      .returning();

    return NextResponse.json(rowToProject(row), { status: 201 });
  } catch (err) {
    console.error("Failed to create project:", err);
    return jsonInternalError("Failed to create project.");
  }
}
