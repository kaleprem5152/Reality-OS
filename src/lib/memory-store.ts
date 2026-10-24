import type { Project, Report, ReportContent } from "@/lib/types";
import { SEED_PROJECTS } from "@/lib/data/seed";
import { buildDemoAnalysis } from "@/lib/demo-analysis";
import { reportFromAnalysis } from "@/lib/report-builder";

// Global cache so hot reloading doesn't reset in-memory state
const globalForMemory = globalThis as typeof globalThis & {
  __realityos_memory_projects?: Project[];
  __realityos_memory_reports?: Report[];
};

function initMemoryProjects(): Project[] {
  return JSON.parse(JSON.stringify(SEED_PROJECTS));
}

function initMemoryReports(): Report[] {
  const metro = SEED_PROJECTS.find((p) => p.featured) || SEED_PROJECTS[0];
  const analysis = buildDemoAnalysis(metro, metro.requirements, [
    "Optimize accessibility",
    "Control capital cost",
    "Deliver by 2032",
  ]);

  return [
    {
      id: "RPT-5001",
      projectId: metro.id,
      title: "Metro Intelligence — Structured Planning Analysis",
      reportType: "Planning Analysis",
      status: "Final",
      content: reportFromAnalysis(analysis),
      createdAt: new Date(Date.now() - 2.2 * 864e5).toISOString(),
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
        assumptions: [
          "Parcel count from illustrative alignment GIS overlay.",
          "Statutory powers assumed in force by award.",
        ],
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
      } as unknown as ReportContent,
      createdAt: new Date(Date.now() - 4.6 * 864e5).toISOString(),
    },
  ];
}

if (!globalForMemory.__realityos_memory_projects) {
  globalForMemory.__realityos_memory_projects = initMemoryProjects();
}
if (!globalForMemory.__realityos_memory_reports) {
  globalForMemory.__realityos_memory_reports = initMemoryReports();
}

export const memoryStore = {
  getProjects(): Project[] {
    return globalForMemory.__realityos_memory_projects!;
  },
  getProject(id: string): Project | null {
    return globalForMemory.__realityos_memory_projects!.find((p) => p.id === id) ?? null;
  },
  createProject(data: Partial<Project> & { name: string; infraType: Project["infraType"]; region: string; budgetCrore: number; targetCompletion: string }): Project {
    const list = globalForMemory.__realityos_memory_projects!;
    const maxNum = list.reduce((m, row) => {
      const n = parseInt(row.id.replace(/\D/g, ""), 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 1000);
    const id = `PRJ-${maxNum + 1}`;
    const now = new Date().toISOString();
    const newProj: Project = {
      id,
      name: data.name,
      description: data.description || "",
      infraType: data.infraType,
      region: data.region,
      status: "Planning",
      budgetCrore: data.budgetCrore,
      targetCompletion: data.targetCompletion,
      riskLevel: data.riskLevel || "Moderate",
      capacityTarget: data.capacityTarget || "",
      sustainabilityPriorities: data.sustainabilityPriorities || [],
      requirements: data.requirements || "",
      stations: data.stations ?? null,
      corridorKm: data.corridorKm ?? null,
      featured: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    list.push(newProj);
    return newProj;
  },
  updateProject(id: string, patch: Partial<Project>): Project | null {
    const list = globalForMemory.__realityos_memory_projects!;
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const updated: Project = {
      ...list[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    if (patch.archived === true) {
      updated.status = "Archived";
    } else if (patch.archived === false && !patch.status) {
      updated.status = "Planning";
    }
    list[idx] = updated;
    return updated;
  },
  deleteProject(id: string): boolean {
    const list = globalForMemory.__realityos_memory_projects!;
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    // cascade delete reports
    const repList = globalForMemory.__realityos_memory_reports!;
    globalForMemory.__realityos_memory_reports = repList.filter((r) => r.projectId !== id);
    return true;
  },
  getReports(): Report[] {
    return globalForMemory.__realityos_memory_reports!;
  },
  getReport(id: string): Report | null {
    return globalForMemory.__realityos_memory_reports!.find((r) => r.id === id) ?? null;
  },
  createReport(data: { projectId: string; title: string; reportType: Report["reportType"]; status: Report["status"]; content: ReportContent }): Report {
    const list = globalForMemory.__realityos_memory_reports!;
    const maxNum = list.reduce((m, row) => {
      const n = parseInt(row.id.replace(/\D/g, ""), 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 5000);
    const id = `RPT-${maxNum + 1}`;
    const newRep: Report = {
      id,
      projectId: data.projectId,
      title: data.title,
      reportType: data.reportType,
      status: data.status,
      content: data.content,
      createdAt: new Date().toISOString(),
    };
    list.unshift(newRep);
    return newRep;
  },
  updateReport(id: string, patch: Partial<Report>): Report | null {
    const list = globalForMemory.__realityos_memory_reports!;
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const updated: Report = {
      ...list[idx],
      ...patch,
    };
    list[idx] = updated;
    return updated;
  },
  deleteReport(id: string): boolean {
    const list = globalForMemory.__realityos_memory_reports!;
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    return true;
  },
};
