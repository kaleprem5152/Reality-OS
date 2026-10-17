import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { memoryStore } from "@/lib/memory-store";
import { rowToReport } from "../route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!db) {
    const r = memoryStore.getReport(id);
    if (!r) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json(r);
  }
  try {
    const rows = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    if (rows.length === 0) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json(rowToReport(rows[0]));
  } catch {
    const r = memoryStore.getReport(id);
    if (!r) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json(r);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!db) {
    const ok = memoryStore.deleteReport(id);
    if (!ok) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  try {
    const deleted = await db.delete(reports).where(eq(reports.id, id)).returning({ id: reports.id });
    if (deleted.length === 0) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete report" },
      { status: 500 },
    );
  }
}
