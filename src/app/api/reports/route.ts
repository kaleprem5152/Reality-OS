import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { reports, projects } from "@/db/schema";
import type { Report, ReportContent } from "@/lib/types";
import { buildDemoAnalysis } from "@/lib/demo-analysis";
import { reportFromAnalysis } from "@/lib/report-builder";
import { SEED_PROJECTS } from "@/lib/data/seed";
import { memoryStore } from "@/lib/memory-store";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

let seeded = false;

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

async function ensureSeeded() {
  if (!db || seeded) return;
  try {
    const existing = await db.select({ id: reports.id }).from(reports).limit(1);
    if (existing.length === 0) {
      const metro = SEED_PROJECTS.find((p) => p.featured)!;
      let metroInDb = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, metro.id)).limit(1);
      if (metroInDb.length === 0) {
        await db
          .insert(projects)
          .values(
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
          )
          .onConflictDoNothing();
        metroInDb = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, metro.id)).limit(1);
      }
      if (metroInDb.length > 0) {
        const analysis = buildDemoAnalysis(metro, metro.requirements, [
          "Optimize accessibility",
          "Control capital cost",
          "Deliver by 2032",
        ]);
        await db
          .insert(reports)
          .values([
            {
              id: "RPT-5001",
              projectId: metro.id,
              title: "Metro Intelligence — Structured Planning Analysis",
              reportType: "Planning Analysis",
              status: "Final",
              content: reportFromAnalysis(analysis) as unknown as Record<string, unknown>,
              createdAt: new Date(Date.now() - 2.2 * 864e5),
            },
            {
              id: "RPT-5002",
              projectId: metro.id,
              title: "Metro Intelligence — Land Acquisition Risk Note",
              reportType: "Risk Assessment",
              status: "Draft",
              content: {
                executiveSummary:
                  "62 land parcels are identified across the two Metro Intelligence corridors; 14 sit on the Phase 1 critical path. Acquisition delay is the highest-rated schedule exposure in the register.",
                assumptions: ["Parcel count from illustrative alignment GIS overlay.", "Statutory powers assumed in force by award."],
                costBreakdown: [
                  { label: "Acquisition provision (within land budget)", valueCrore: 1450, note: "14 critical-path parcels" },
                  { label: "Rehabilitation & resettlement provision", valueCrore: 260 },
                ],
                milestones: [
                  { phase: "Notification & objections", window: "Months 0–6", detail: "Section notifications for 62 parcels." },
                  { phase: "Valuation & awards", window: "Months 5–14", detail: "Milestone-based escrow releases." },
                ],
                riskRegister: [
                  { risk: "Objection-driven delay on critical-path parcels", severity: "High", mitigation: "Early negotiation with escrow milestone incentives." },
                  { risk: "Title disputes in historic core", severity: "Moderate", mitigation: "Title insurance and pre-notification surveys." },
                ],
                environmental: ["Heritage precinct conditions apply to 5 parcels adjoining Old Market station."],
                recommendations: [
                  { title: "Sequence critical-path parcels first", rationale: "Fourteen parcels gate two station boxes and the depot access; acquiring them first compresses schedule float consumption." },
                  { title: "Bind escrow to possession milestones", rationale: "Links disbursement to actual possession, reducing dispute-driven hold-ups." },
                ],
                evidence: [
                  { label: "Illustrative parcel overlay (demo dataset)", kind: "Illustrative" },
                  { label: "Scenario engine schedule heuristics", kind: "Internal analysis" },
                ],
              } as unknown as Record<string, unknown>,
              createdAt: new Date(Date.now() - 4.6 * 864e5),
            },
          ])
          .onConflictDoNothing();
        seeded = true;
      }
    } else {
      seeded = true;
    }
  } catch (err) {
    console.warn("Reports seed skipped, falling back to memoryStore:", err);
  }
}

export async function GET() {
  if (!db) {
    return NextResponse.json(memoryStore.getReports());
  }
  try {
    await ensureSeeded();
    const rows = await db.select().from(reports).orderBy(desc(reports.createdAt));
    return NextResponse.json(rows.map(rowToReport));
  } catch (e) {
    console.warn("DB reports select failed, falling back to memoryStore:", e);
    return NextResponse.json(memoryStore.getReports());
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projectId = String(body.projectId ?? "");
    const title = String(body.title ?? "").trim();
    const reportType = String(body.reportType ?? "Planning Analysis") as Report["reportType"];
    if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    if (!title) return NextResponse.json({ error: "Report title is required" }, { status: 400 });
    if (!body.content || typeof body.content !== "object")
      return NextResponse.json({ error: "Report content is required" }, { status: 400 });

    if (!db) {
      const rep = memoryStore.createReport({
        projectId,
        title,
        reportType,
        status: body.status === "Final" ? "Final" : "Draft",
        content: body.content as ReportContent,
      });
      return NextResponse.json(rep, { status: 201 });
    }

    const existing = await db.select({ id: reports.id }).from(reports);
    const maxNum = existing.reduce((m: number, row: { id: string }) => {
      const n = parseInt(row.id.replace(/\D/g, ""), 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 5000);
    const [row] = await db
      .insert(reports)
      .values({
        id: `RPT-${maxNum + 1}`,
        projectId,
        title,
        reportType,
        status: body.status === "Final" ? "Final" : "Draft",
        content: body.content as Record<string, unknown>,
      })
      .returning();
    return NextResponse.json(rowToReport(row), { status: 201 });
  } catch (e) {
    if (!db) {
      return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create report" },
      { status: 500 },
    );
  }
}
