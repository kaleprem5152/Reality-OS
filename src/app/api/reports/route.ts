import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, projects } from "@/db/schema";
import type { Report, ReportContent } from "@/lib/types";
import { memoryStore } from "@/lib/memory-store";
import {
  authenticateApiRequest,
  canWrite,
  createApiAuthErrorResponse,
  jsonForbidden,
  jsonInternalError,
  jsonNotFound,
} from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export function rowToReport(r: typeof reports.$inferSelect): Report {
  return {
    id: r.id,
    projectId: r.projectId,
    title: r.title,
    reportType: r.reportType as Report["reportType"],
    status: r.status as Report["status"],
    content: r.content as unknown as ReportContent,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  const authError = createApiAuthErrorResponse(auth);
  if (authError) return authError;

  // Sandbox demo sessions to memory store; never access PostgreSQL
  if (auth.status === "demo") {
    return NextResponse.json(memoryStore.getReports());
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
      .from(reports)
      .where(eq(reports.workspaceId, auth.workspace.workspaceId))
      .orderBy(desc(reports.createdAt));

    return NextResponse.json(rows.map(rowToReport));
  } catch (err) {
    console.error("Failed to fetch reports:", err);
    return jsonInternalError("Failed to fetch reports.");
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  const authError = createApiAuthErrorResponse(auth);
  if (authError) return authError;

  // Enforce mutation permissions: viewers cannot create reports
  if (!canWrite(auth)) {
    return jsonForbidden("Insufficient permissions to create reports in this workspace.");
  }

  try {
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

    const projectId = String(b.projectId ?? "").trim();
    const title = String(b.title ?? "").trim();
    const reportType = (String(b.reportType ?? "Planning Analysis") || "Planning Analysis") as Report["reportType"];

    if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    if (!title) return NextResponse.json({ error: "Report title is required" }, { status: 400 });
    if (!b.content || typeof b.content !== "object") {
      return NextResponse.json({ error: "Report content is required" }, { status: 400 });
    }

    // Sandbox demo sessions strictly to memory store
    if (auth.status === "demo") {
      const parentProject = memoryStore.getProject(projectId);
      if (!parentProject) {
        return jsonNotFound("Project not found");
      }

      const rep = memoryStore.createReport({
        projectId,
        title,
        reportType,
        status: b.status === "Final" ? "Final" : "Draft",
        content: b.content as ReportContent,
      });
      return NextResponse.json(rep, { status: 201 });
    }

    if (auth.status !== "authenticated") {
      return jsonInternalError("Unexpected authentication state.");
    }

    if (!db) {
      return jsonInternalError("Database connection is not configured.");
    }

    // Verify referenced parent project exists within the same authorized workspace
    const parentProject = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.workspaceId, auth.workspace.workspaceId)
        )
      )
      .limit(1);

    if (parentProject.length === 0) {
      return jsonNotFound("Project not found");
    }

    // Determine sequential report ID
    const existing = await db.select({ id: reports.id }).from(reports);
    const maxNum = existing.reduce((m: number, row: { id: string }) => {
      const n = parseInt(row.id.replace(/\D/g, ""), 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 5000);
    const id = `RPT-${maxNum + 1}`;

    const [row] = await db
      .insert(reports)
      .values({
        id,
        workspaceId: auth.workspace.workspaceId,
        projectId,
        createdBy: auth.user.id,
        title,
        reportType,
        status: b.status === "Final" ? "Final" : "Draft",
        content: b.content as Record<string, unknown>,
      })
      .returning();

    return NextResponse.json(rowToReport(row), { status: 201 });
  } catch (err) {
    console.error("Failed to create report:", err);
    return jsonInternalError("Failed to create report.");
  }
}
