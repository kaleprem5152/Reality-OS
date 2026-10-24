import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createMockNextRequest,
  createMockDemoContext,
  createMockUnauthenticatedContext,
  createMockAuthenticatedContext,
} from "../helpers/mock-auth";
import {
  createMockReportRow,
  type MockDb,
} from "../helpers/mock-db";
import { exportReportPdf } from "@/lib/pdf";
import type { Report, Project } from "@/lib/types";

// Hoisted state shared with vi.mock
const { getApiAuthResult, setApiAuthResult } = vi.hoisted(() => {
  let currentApiAuth: any = null;

  return {
    getApiAuthResult: () => currentApiAuth,
    setApiAuthResult: (r: any) => {
      currentApiAuth = r;
    },
  };
});

// 1. Mock DB to prevent real PostgreSQL connections
vi.mock("@/db", async () => {
  const { createMockDb } = await import("../helpers/mock-db");
  return {
    db: createMockDb(),
    pool: null,
  };
});

// 2. Mock authenticateApiRequest
vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    authenticateApiRequest: vi.fn(async () => getApiAuthResult()),
  };
});

// 3. Mock jsPDF constructible class
vi.mock("jspdf", () => {
  function MockJsPdf() {
    return {
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
      },
      splitTextToSize: vi.fn((text: string) => [text]),
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      setDrawColor: vi.fn(),
      setFillColor: vi.fn(),
      rect: vi.fn(),
      roundedRect: vi.fn(),
      line: vi.fn(),
      circle: vi.fn(),
      text: vi.fn(),
      addPage: vi.fn(),
      getNumberOfPages: vi.fn(() => 1),
      setPage: vi.fn(),
      save: vi.fn(),
    };
  }
  return {
    jsPDF: MockJsPdf,
    default: MockJsPdf,
  };
});

// Import route handlers under test
import { GET as getReports, POST as postReports } from "@/app/api/reports/route";
import {
  GET as getReportById,
  PATCH as patchReportById,
  DELETE as deleteReportById,
} from "@/app/api/reports/[id]/route";
import { POST as postAiAnalyze } from "@/app/api/ai/analyze/route";
import { db as rawDb } from "@/db";

describe("09 - Reports CRUD, Editing, AI Pipeline, and PDF Export Test Suite", () => {
  const db = rawDb as unknown as MockDb;
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  // =========================================================================
  // Section 1: Reports CRUD & Persistence (Authenticated Mode)
  // =========================================================================
  describe("Reports CRUD and Workspace Persistence", () => {
    it("persists a newly created report to the workspace database with generated RPT- ID", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        userId: "usr-editor-1",
        workspaceId: "ws-alpha-123",
      });
      setApiAuthResult(auth);

      // 1. SELECT max(id) -> returns empty so starts at RPT-5001
      // 2. INSERT into reports -> returns created row
      const mockCreated = createMockReportRow({
        id: "RPT-5001",
        workspaceId: "ws-alpha-123",
        projectId: "PRJ-1001",
        createdBy: "usr-editor-1",
        title: "Alpha Rail Corridor — Environmental Review",
        reportType: "Environmental",
        status: "Draft",
        content: { executiveSummary: "Detailed environmental baseline." },
      });
      db.queueResults([[], [mockCreated]]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/reports",
        method: "POST",
        body: {
          projectId: "PRJ-1001",
          title: "Alpha Rail Corridor — Environmental Review",
          reportType: "Environmental",
          status: "Draft",
          content: { executiveSummary: "Detailed environmental baseline." },
        },
      });

      const res = await postReports(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe("RPT-5001");
      expect(data.projectId).toBe("PRJ-1001");
      expect(data.title).toBe("Alpha Rail Corridor — Environmental Review");
      expect(data.status).toBe("Draft");

      // Verify queries executed with workspace isolation
      const insertQuery = db.getExecutedQueries().find((q) => q.operation === "insert");
      expect(insertQuery).toBeDefined();
      expect((insertQuery?.insertValues as any).workspaceId).toBe("ws-alpha-123");
      expect((insertQuery?.insertValues as any).createdBy).toBe("usr-editor-1");
    });

    it("retrieves workspace reports filtered by authenticated workspace ID", async () => {
      const auth = createMockAuthenticatedContext("viewer", {
        userId: "usr-viewer-1",
        workspaceId: "ws-alpha-123",
      });
      setApiAuthResult(auth);

      const rpt1 = createMockReportRow({ id: "RPT-5001", workspaceId: "ws-alpha-123", title: "Report One" });
      const rpt2 = createMockReportRow({ id: "RPT-5002", workspaceId: "ws-alpha-123", title: "Report Two" });
      db.queueResult([rpt1, rpt2]);

      const req = createMockNextRequest({ url: "http://localhost:3000/api/reports", method: "GET" });
      const res = await getReports(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0].id).toBe("RPT-5001");
      expect(data[1].id).toBe("RPT-5002");
    });

    it("retrieves a single report by ID within the authenticated workspace", async () => {
      const auth = createMockAuthenticatedContext("viewer", {
        userId: "usr-viewer-1",
        workspaceId: "ws-alpha-123",
      });
      setApiAuthResult(auth);

      const mockRow = createMockReportRow({
        id: "RPT-5001",
        workspaceId: "ws-alpha-123",
        title: "Specific Analysis Report",
      });
      db.queueResult([mockRow]);

      const req = createMockNextRequest({ url: "http://localhost:3000/api/reports/RPT-5001", method: "GET" });
      const res = await getReportById(req, { params: Promise.resolve({ id: "RPT-5001" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("RPT-5001");
      expect(data.title).toBe("Specific Analysis Report");
    });

    it("updates report status and content via PATCH with workspace scoping", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        userId: "usr-editor-1",
        workspaceId: "ws-alpha-123",
      });
      setApiAuthResult(auth);

      const updatedRow = createMockReportRow({
        id: "RPT-5001",
        workspaceId: "ws-alpha-123",
        status: "Final",
        title: "Finalized Assessment Report",
      });
      // 1. SELECT existing report lookup
      // 2. UPDATE report -> returns updated row
      db.queueResults([[{ id: "RPT-5001" }], [updatedRow]]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/reports/RPT-5001",
        method: "PATCH",
        body: {
          status: "Final",
          title: "Finalized Assessment Report",
        },
      });

      const res = await patchReportById(req, { params: Promise.resolve({ id: "RPT-5001" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("Final");
      expect(data.title).toBe("Finalized Assessment Report");

      const updateQuery = db.getExecutedQueries().find((q) => q.operation === "update");
      expect(updateQuery).toBeDefined();
    });

    it("deletes a report when authorized and scoped to workspace", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        userId: "usr-editor-1",
        workspaceId: "ws-alpha-123",
      });
      setApiAuthResult(auth);

      // 1. SELECT to check existence and creator
      db.queueResult([{ id: "RPT-5001", createdBy: "usr-editor-1" }]);
      // 2. DELETE returning id
      db.queueResult([{ id: "RPT-5001" }]);

      const req = createMockNextRequest({ url: "http://localhost:3000/api/reports/RPT-5001", method: "DELETE" });
      const res = await deleteReportById(req, { params: Promise.resolve({ id: "RPT-5001" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ ok: true });

      const deleteQuery = db.getExecutedQueries().find((q) => q.operation === "delete");
      expect(deleteQuery).toBeDefined();
    });
  });

  // =========================================================================
  // Section 2: Security, RBAC & Isolation
  // =========================================================================
  describe("Security, RBAC, and Isolation", () => {
    it("returns 401 unauthenticated for report routes", async () => {
      setApiAuthResult(createMockUnauthenticatedContext());

      const getReq = createMockNextRequest({ url: "http://localhost:3000/api/reports", method: "GET" });
      expect((await getReports(getReq)).status).toBe(401);

      const postReq = createMockNextRequest({ url: "http://localhost:3000/api/reports", method: "POST", body: { title: "Test" } });
      expect((await postReports(postReq)).status).toBe(401);

      const patchReq = createMockNextRequest({ url: "http://localhost:3000/api/reports/RPT-1", method: "PATCH", body: { status: "Final" } });
      expect((await patchReportById(patchReq, { params: Promise.resolve({ id: "RPT-1" }) })).status).toBe(401);

      const deleteReq = createMockNextRequest({ url: "http://localhost:3000/api/reports/RPT-1", method: "DELETE" });
      expect((await deleteReportById(deleteReq, { params: Promise.resolve({ id: "RPT-1" }) })).status).toBe(401);
    });

    it("prevents viewers from creating, updating, or deleting reports (403 Forbidden)", async () => {
      const viewerAuth = createMockAuthenticatedContext("viewer", {
        userId: "usr-viewer-1",
        workspaceId: "ws-alpha-123",
      });
      setApiAuthResult(viewerAuth);

      const postReq = createMockNextRequest({
        url: "http://localhost:3000/api/reports",
        method: "POST",
        body: { projectId: "PRJ-1", title: "Viewer Report", reportType: "Environmental", status: "Draft" },
      });
      expect((await postReports(postReq)).status).toBe(403);

      // Patch: lookup found, then rejected by canWrite
      db.queueResult([{ id: "RPT-5001" }]);
      const patchReq = createMockNextRequest({
        url: "http://localhost:3000/api/reports/RPT-5001",
        method: "PATCH",
        body: { status: "Final" },
      });
      expect((await patchReportById(patchReq, { params: Promise.resolve({ id: "RPT-5001" }) })).status).toBe(403);

      // Delete: lookup found, then rejected by canDeleteRecord
      db.queueResult([{ id: "RPT-5001", createdBy: "usr-editor-1" }]);
      const deleteReq = createMockNextRequest({ url: "http://localhost:3000/api/reports/RPT-5001", method: "DELETE" });
      expect((await deleteReportById(deleteReq, { params: Promise.resolve({ id: "RPT-5001" }) })).status).toBe(403);
    });

    it("prevents editors from deleting reports created by another user (RBAC)", async () => {
      const editorAuth = createMockAuthenticatedContext("editor", {
        userId: "usr-editor-attacker",
        workspaceId: "ws-alpha-123",
      });
      setApiAuthResult(editorAuth);

      // Report created by another user: usr-original-author
      db.queueResult([{ id: "RPT-5001", createdBy: "usr-original-author" }]);

      const deleteReq = createMockNextRequest({ url: "http://localhost:3000/api/reports/RPT-5001", method: "DELETE" });
      const res = await deleteReportById(deleteReq, { params: Promise.resolve({ id: "RPT-5001" }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Insufficient permissions");
    });

    it("returns 404 for foreign workspace reports (cross-workspace denial)", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        userId: "usr-editor-beta",
        workspaceId: "ws-beta-999",
      });
      setApiAuthResult(auth);

      // Database returns empty because whereCondition enforces workspaceId = ws-beta-999
      db.queueResult([]);

      const getReq = createMockNextRequest({ url: "http://localhost:3000/api/reports/RPT-FOREIGN", method: "GET" });
      const res = await getReportById(getReq, { params: Promise.resolve({ id: "RPT-FOREIGN" }) });
      expect(res.status).toBe(404);
    });

    it("fails closed with 500 when database fails and does NOT silently fall back to memory", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        workspaceId: "ws-alpha-123",
      });
      setApiAuthResult(auth);

      db.throwOnNext(new Error("Connection to PostgreSQL failed"));

      const getReq = createMockNextRequest({ url: "http://localhost:3000/api/reports", method: "GET" });
      const res = await getReports(getReq);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("Failed to fetch reports.");

      // Verify that memory store reports were NOT returned
      expect(Array.isArray(data)).toBe(false);
    });
  });

  // =========================================================================
  // Section 3: AI Assessment Pipeline
  // =========================================================================
  describe("AI Assessment Pipeline (/api/ai/analyze)", () => {
    it("returns 401 unauthenticated before checking Gemini key or calling external services", async () => {
      setApiAuthResult(createMockUnauthenticatedContext());
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: { requirements: "Build a high speed rail link." },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(401);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns 400 when requirements brief is missing or empty", async () => {
      const auth = createMockAuthenticatedContext("editor");
      setApiAuthResult(auth);
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: { requirements: "" },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(400);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("uses local deterministic demo engine in demo mode and NEVER invokes Gemini API", async () => {
      setApiAuthResult(createMockDemoContext());
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: {
          projectId: "PRJ-DEMO-1",
          projectName: "Demo Rail Network",
          requirements: "Construct a 50km suburban passenger rail line.",
        },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.analysis).toBeDefined();
      expect(data.analysis.mode).toBe("demo");
      expect(data.analysis.executiveSummary).toBeDefined();
      expect(data.analysis.agents).toHaveLength(5);

      // Verify zero external network requests
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns 503 with actionable error message when GEMINI_API_KEY is not configured", async () => {
      const auth = createMockAuthenticatedContext("editor");
      setApiAuthResult(auth);
      delete process.env.GEMINI_API_KEY;
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: {
          requirements: "Evaluate multi-modal transit hub with solar microgrid.",
        },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.configured).toBe(false);
      expect(data.error).toContain("GEMINI_API_KEY is not configured on the server");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("executes configured Gemini request with server-side key and validates structured output", async () => {
      const auth = createMockAuthenticatedContext("editor");
      setApiAuthResult(auth);
      process.env.GEMINI_API_KEY = "test-gemini-server-key-xyz";

      const validAiOutput = {
        executiveSummary: "This multi-modal corridor project demonstrates robust economic feasibility and strong passenger demand.",
        agents: [
          { agent: "Transportation Planning", summary: "Peak headway of 4 min.", findings: ["f1", "f2", "f3"], metrics: [{ label: "Capacity", value: "40k/hr" }] },
          { agent: "Financial Analysis", summary: "Capex aligned.", findings: ["f1", "f2", "f3"], metrics: [{ label: "EIRR", value: "14.2%" }] },
          { agent: "Environmental Assessment", summary: "Low wetland intrusion.", findings: ["f1", "f2", "f3"], metrics: [{ label: "CO2", value: "-22%" }] },
          { agent: "Utilities & Dependencies", summary: "Substation upgrades identified.", findings: ["f1", "f2", "f3"], metrics: [{ label: "Grid", value: "66kV" }] },
          { agent: "Risk Analysis", summary: "Geotechnical uncertainties managed.", findings: ["f1", "f2", "f3"], metrics: [{ label: "Risk", value: "Moderate" }] },
        ],
        recommendations: [{ title: "Phased rollout", rationale: "Mitigates initial cashflow spikes." }, { title: "Automated signaling", rationale: "Increases safety." }],
        costs: [{ label: "Civil works", valueCrore: 1500, note: "Tracks and tunnels" }],
        deliveryConsiderations: ["Procurement package A", "Package B"],
        environmentalConstraints: ["Buffer zone 500m"],
        dependencies: [{ item: "Power grid", criticality: "High", note: "Substation" }],
        risks: [{ risk: "Monsoon flood", severity: "High", mitigation: "Elevated embankments" }],
        confidence: { score: 88, explanation: "High fidelity corridor telemetry." },
        assumptions: ["Standard gauge alignment", "Land acquisition complete"],
        evidence: [{ label: "Traffic density study", kind: "Internal analysis" }],
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(validAiOutput) }],
              },
            },
          ],
        }),
      });
      globalThis.fetch = fetchSpy;

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: {
          projectId: "PRJ-1001",
          projectName: "Live Rail Project",
          requirements: "Conduct complete multi-agent analysis on high-speed rail corridor.",
        },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.analysis).toBeDefined();
      expect(data.analysis.executiveSummary).toContain("multi-modal corridor project");
      expect(data.analysis.agents).toHaveLength(5);

      // Verify server-side API key was passed in URL query param
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("test-gemini-server-key-xyz"),
        expect.anything(),
      );
    });

    it("handles Gemini rate limit (429) gracefully with actionable message", async () => {
      const auth = createMockAuthenticatedContext("editor");
      setApiAuthResult(auth);
      process.env.GEMINI_API_KEY = "test-key";

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: { requirements: "Analyze urban transit corridor requirements." },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toContain("rate limit reached");
    });
  });

  // =========================================================================
  // Section 4: PDF Export Validation
  // =========================================================================
  describe("PDF Export Functionality", () => {
    it("exports a report with parent project and complete structured sections", () => {
      const mockReport: Report = {
        id: "RPT-5001",
        projectId: "PRJ-1001",
        title: "Alpha Rail Corridor — Environmental Review",
        reportType: "Environmental Review",
        status: "Final",
        content: {
          executiveSummary: "Environmental impact within statutory limits.",
          assumptions: ["Standard gauge alignment", "Zero net deforestation"],
          costBreakdown: [{ label: "Civil works", valueCrore: 1500, note: "Embankment" }],
          milestones: [{ phase: "Phase 1", window: "2026-2027", detail: "Ground preparation" }],
          riskRegister: [{ risk: "Water table rise", severity: "Moderate", mitigation: "Subsurface drainage" }],
          environmental: ["Wetland preservation zone 500m"],
          recommendations: [{ title: "Green corridors", rationale: "Preserve wildlife passage" }],
          evidence: [{ label: "Hydrology assessment 2025", kind: "Internal analysis" }],
        },
        createdAt: "2026-01-01T00:00:00.000Z",
      };

      const mockProject: Project = {
        id: "PRJ-1001",
        name: "Alpha Rail Corridor",
        description: "High speed electric commuter link",
        infraType: "Rail & Transit",
        region: "Western Corridor",
        status: "Planning",
        budgetCrore: 2500,
        targetCompletion: "2029-Q4",
        riskLevel: "Moderate",
        capacityTarget: "500k daily passengers",
        sustainabilityPriorities: ["Solar roofs"],
        requirements: "Electric suburban transit",
        featured: false,
        archived: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      expect(() => exportReportPdf(mockReport, mockProject)).not.toThrow();
    });

    it("exports a report safely without a parent project (null project)", () => {
      const mockReport: Report = {
        id: "RPT-5002",
        projectId: "PRJ-DELETED",
        title: "Standalone Feasibility Assessment",
        reportType: "Planning Analysis",
        status: "Draft",
        content: {
          executiveSummary: "Assessment of independent feeder system.",
          assumptions: [],
          costBreakdown: [],
          milestones: [],
          riskRegister: [],
          environmental: [],
          recommendations: [],
          evidence: [],
        },
        createdAt: "2026-01-01T00:00:00.000Z",
      };

      expect(() => exportReportPdf(mockReport, null)).not.toThrow();
    });

    it("handles empty or partial report content gracefully without throwing", () => {
      const mockReportWithEmptyContent: Report = {
        id: "RPT-5003",
        projectId: "PRJ-1001",
        title: "Empty Content Report",
        reportType: "Risk Assessment",
        status: "Draft",
        content: {} as any,
        createdAt: "2026-01-01T00:00:00.000Z",
      };

      expect(() => exportReportPdf(mockReportWithEmptyContent, null)).not.toThrow();
    });
  });
});
