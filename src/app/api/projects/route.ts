import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { SEED_PROJECTS } from "@/lib/data/seed";
import { memoryStore } from "@/lib/memory-store";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

let seeded = false;

async function ensureSeeded() {
  if (!db || seeded) return;
  try {
    const existing = await db.select({ id: projects.id }).from(projects).limit(1);
    if (existing.length === 0) {
      await db.insert(projects).values(
        SEED_PROJECTS.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          infraType: p.infraType,
          region: p.region,
          status: p.status,
          budgetCrore: p.budgetCrore,
          targetCompletion: p.targetCompletion,
          riskLevel: p.riskLevel,
          capacityTarget: p.capacityTarget,
          sustainabilityPriorities: p.sustainabilityPriorities,
          requirements: p.requirements,
          stations: p.stations,
          corridorKm: p.corridorKm,
          featured: p.featured,
          archived: p.archived,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        })),
      ).onConflictDoNothing();
    }
    seeded = true;
  } catch (err) {
    console.warn("Database seeding skipped, using memory fallback:", err);
  }
}

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

export async function GET() {
  if (!db) {
    return NextResponse.json(memoryStore.getProjects());
  }
  try {
    await ensureSeeded();
    const rows = await db.select().from(projects).orderBy(asc(projects.id));
    return NextResponse.json(rows.map(rowToProject));
  } catch (e) {
    console.warn("DB query failed, returning memory store projects:", e);
    return NextResponse.json(memoryStore.getProjects());
  }
}

function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const infraType = String(body.infraType ?? "").trim();
    const region = String(body.region ?? "").trim();
    const budget = Number(body.budgetCrore);
    if (!name || name.length < 3) return bad("Project name is required (min 3 characters).");
    if (!infraType) return bad("Infrastructure type is required.");
    if (!region) return bad("Geographic region is required.");
    if (!Number.isFinite(budget) || budget <= 0) return bad("Estimated budget must be a positive number.");
    const targetCompletion = String(body.targetCompletion ?? "").trim();
    if (!targetCompletion) return bad("Target completion is required.");

    if (!db) {
      const p = memoryStore.createProject({
        name,
        description,
        infraType: infraType as Project["infraType"],
        region,
        budgetCrore: budget,
        targetCompletion,
        riskLevel: (body.riskLevel as Project["riskLevel"]) || "Moderate",
        capacityTarget: String(body.capacityTarget ?? ""),
        sustainabilityPriorities: Array.isArray(body.sustainabilityPriorities)
          ? body.sustainabilityPriorities.filter((x: unknown) => typeof x === "string")
          : [],
        requirements: String(body.requirements ?? ""),
        stations: body.stations ? Number(body.stations) : null,
        corridorKm: body.corridorKm ? Number(body.corridorKm) : null,
      });
      return NextResponse.json(p, { status: 201 });
    }

    await ensureSeeded();
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
        name,
        description,
        infraType,
        region,
        status: "Planning",
        budgetCrore: budget,
        targetCompletion,
        riskLevel: "Moderate",
        capacityTarget: String(body.capacityTarget ?? ""),
        sustainabilityPriorities: Array.isArray(body.sustainabilityPriorities)
          ? body.sustainabilityPriorities.filter((x: unknown) => typeof x === "string")
          : [],
        requirements: String(body.requirements ?? ""),
        featured: false,
        archived: false,
      })
      .returning();
    return NextResponse.json(rowToProject(row), { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create project" },
      { status: 500 },
    );
  }
}
