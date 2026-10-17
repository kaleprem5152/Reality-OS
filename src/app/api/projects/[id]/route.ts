import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, reports } from "@/db/schema";
import { memoryStore } from "@/lib/memory-store";
import { rowToProject } from "../route";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!db) {
    const p = memoryStore.getProject(id);
    if (!p) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json(p);
  }
  try {
    const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (rows.length === 0) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json(rowToProject(rows[0]));
  } catch {
    const p = memoryStore.getProject(id);
    if (!p) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json(p);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.name === "string") {
      if (body.name.trim().length < 3)
        return NextResponse.json({ error: "Project name is required (min 3 characters)." }, { status: 400 });
      patch.name = body.name.trim();
    }
    if (typeof body.description === "string") patch.description = body.description;
    if (typeof body.infraType === "string") patch.infraType = body.infraType;
    if (typeof body.region === "string") patch.region = body.region;
    if (typeof body.status === "string") patch.status = body.status;
    if (typeof body.targetCompletion === "string") patch.targetCompletion = body.targetCompletion;
    if (typeof body.riskLevel === "string") patch.riskLevel = body.riskLevel;
    if (typeof body.capacityTarget === "string") patch.capacityTarget = body.capacityTarget;
    if (typeof body.requirements === "string") patch.requirements = body.requirements;
    if (typeof body.archived === "boolean") {
      patch.archived = body.archived;
      if (body.archived) patch.status = "Archived";
    }
    if (body.budgetCrore !== undefined) {
      const b = Number(body.budgetCrore);
      if (!Number.isFinite(b) || b <= 0)
        return NextResponse.json({ error: "Estimated budget must be a positive number." }, { status: 400 });
      patch.budgetCrore = b;
    }
    if (Array.isArray(body.sustainabilityPriorities)) {
      patch.sustainabilityPriorities = body.sustainabilityPriorities.filter(
        (x: unknown) => typeof x === "string",
      );
    }

    if (!db) {
      const p = memoryStore.updateProject(id, patch as Partial<Project>);
      if (!p) return NextResponse.json({ error: "Project not found" }, { status: 404 });
      return NextResponse.json(p);
    }

    const [row] = await db.update(projects).set(patch).where(eq(projects.id, id)).returning();
    if (!row) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json(rowToProject(row));
  } catch (e) {
    if (!db) {
      return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update project" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!db) {
    const ok = memoryStore.deleteProject(id);
    if (!ok) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  try {
    await db.delete(reports).where(eq(reports.projectId, id));
    const deleted = await db.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id });
    if (deleted.length === 0) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete project" },
      { status: 500 },
    );
  }
}
