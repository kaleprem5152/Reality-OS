import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { memoryStore } from "@/lib/memory-store";
import { rowToReport } from "../route";
import type { Report } from "@/lib/types";
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
    const r = memoryStore.getReport(id);
    if (!r) return jsonNotFound("Report not found");
    return NextResponse.json(r);
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
      .where(
        and(
          eq(reports.id, id),
          eq(reports.workspaceId, auth.workspace.workspaceId)
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return jsonNotFound("Report not found");
    }

    return NextResponse.json(rowToReport(rows[0]));
  } catch (err) {
    console.error("Failed to fetch report:", err);
    return jsonInternalError("Failed to fetch report.");
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authenticateApiRequest(req);
  const authError = createApiAuthErrorResponse(auth);
  if (authError) return authError;

  // Sandbox demo sessions strictly to memory store
  if (auth.status === "demo") {
    const existing = memoryStore.getReport(id);
    if (!existing) return jsonNotFound("Report not found");

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
    const patch: Partial<Report> = {};

    if (typeof b.title === "string") {
      if (b.title.trim().length < 3) {
        return NextResponse.json({ error: "Report title must be at least 3 characters." }, { status: 400 });
      }
      patch.title = b.title.trim();
    }
    if (b.status === "Draft" || b.status === "Final") {
      patch.status = b.status;
    }
    if (b.content && typeof b.content === "object") {
      patch.content = b.content as Report["content"];
    }

    const updated = memoryStore.updateReport(id, patch);
    if (!updated) return jsonNotFound("Report not found");
    return NextResponse.json(updated);
  }

  if (auth.status !== "authenticated") {
    return jsonInternalError("Unexpected authentication state.");
  }

  if (!db) {
    return jsonInternalError("Database connection is not configured.");
  }

  try {
    // 1. Look up report scoped by id AND workspaceId
    const existing = await db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.id, id),
          eq(reports.workspaceId, auth.workspace.workspaceId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return jsonNotFound("Report not found");
    }

    // 2. Enforce authorization: viewers cannot update reports
    if (!canWrite(auth)) {
      return jsonForbidden("Insufficient permissions to update reports in this workspace.");
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
    const patch: Record<string, unknown> = {};

    if (typeof b.title === "string") {
      if (b.title.trim().length < 3) {
        return NextResponse.json({ error: "Report title must be at least 3 characters." }, { status: 400 });
      }
      patch.title = b.title.trim();
    }
    if (b.status === "Draft" || b.status === "Final") {
      patch.status = b.status;
    }
    if (b.content && typeof b.content === "object") {
      patch.content = b.content;
    }

    // 4. Update report scoped strictly to ID and authenticated workspace ID
    const [row] = await db
      .update(reports)
      .set(patch)
      .where(
        and(
          eq(reports.id, id),
          eq(reports.workspaceId, auth.workspace.workspaceId)
        )
      )
      .returning();

    if (!row) {
      return jsonNotFound("Report not found");
    }

    return NextResponse.json(rowToReport(row));
  } catch (err) {
    console.error("Failed to update report:", err);
    return jsonInternalError("Failed to update report.");
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authenticateApiRequest(req);
  const authError = createApiAuthErrorResponse(auth);
  if (authError) return authError;

  // Sandbox demo sessions strictly to memory store
  if (auth.status === "demo") {
    const ok = memoryStore.deleteReport(id);
    if (!ok) return jsonNotFound("Report not found");
    return NextResponse.json({ ok: true });
  }

  if (auth.status !== "authenticated") {
    return jsonInternalError("Unexpected authentication state.");
  }

  if (!db) {
    return jsonInternalError("Database connection is not configured.");
  }

  try {
    // 1. Look up report scoped by id AND workspaceId
    // Returns 404 if not found in caller's workspace, including IDs belonging to another workspace.
    const existing = await db
      .select({
        id: reports.id,
        createdBy: reports.createdBy,
      })
      .from(reports)
      .where(
        and(
          eq(reports.id, id),
          eq(reports.workspaceId, auth.workspace.workspaceId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return jsonNotFound("Report not found");
    }

    const targetReport = existing[0];

    // 2. Check authorization before mutation
    // Admin/owner: may delete any report in their workspace.
    // Editor: may delete ONLY reports whose created_by matches their verified Supabase user ID.
    // Viewer: cannot delete -> 403.
    if (!canDeleteRecord(auth, targetReport.createdBy)) {
      return jsonForbidden("Insufficient permissions to delete this report.");
    }

    // 3. Delete report scoped by id AND workspaceId
    const deleted = await db
      .delete(reports)
      .where(
        and(
          eq(reports.id, id),
          eq(reports.workspaceId, auth.workspace.workspaceId)
        )
      )
      .returning({ id: reports.id });

    if (deleted.length === 0) {
      return jsonNotFound("Report not found");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete report:", err);
    return jsonInternalError("Failed to delete report.");
  }
}
