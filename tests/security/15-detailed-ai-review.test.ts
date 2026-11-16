import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createMockNextRequest,
  createMockDemoContext,
  createMockAuthenticatedContext,
} from "../helpers/mock-auth";
import {
  createMockProjectRow,
  type MockDb,
} from "../helpers/mock-db";
import { buildDemoAnalysis } from "@/lib/demo-analysis";
import { reportFromAnalysis } from "@/lib/report-builder";
import { exportReportPdf } from "@/lib/pdf";
import type { Project, Report } from "@/lib/types";

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

// Mock DB
vi.mock("@/db", async () => {
  const { createMockDb } = await import("../helpers/mock-db");
  return {
    db: createMockDb(),
    pool: null,
  };
});

// Mock authenticateApiRequest
vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    authenticateApiRequest: vi.fn(async () => getApiAuthResult()),
  };
});

// Mock jsPDF
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

// Import route handler
import { POST as postAiAnalyze } from "@/app/api/ai/analyze/route";
import { db as rawDb } from "@/db";

describe("15 - Detailed AI Review Comprehensive Test Suite", () => {
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
  // Section 1: Deterministic Demo Analysis (All 9 Sections)
  // =========================================================================
  describe("buildDemoAnalysis 9-Section Structure", () => {
    const demoProject: Project = {
      id: "PRJ-DEMO-TEST",
      name: "Metro Phase 3 South",
      description: "28.5km suburban rapid transit corridor connecting suburban hubs",
      infraType: "Rail & Transit",
      region: "South Corridor",
      status: "Planning",
      budgetCrore: 4200,
      targetCompletion: "2030-12-31",
      corridorKm: 28.5,
      stations: 22,
      riskLevel: "Moderate",
      capacityTarget: "500,000 daily commuters",
      sustainabilityPriorities: ["Solar roofs", "Energy storage"],
      requirements: "CBTC automation",
      featured: false,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it("generates all 9 detailed review sections with evidence-based attributes", () => {
      const result = buildDemoAnalysis(
        demoProject,
        "Deliver automated CBTC signaling, grade-separated stations, and feeder bus interchanges.",
        ["Control capital cost", "Optimize accessibility"]
      );

      expect(result.detailedReview).toBeDefined();
      const review = result.detailedReview!;

      // 1. Executive Summary
      expect(review.executiveSummary).toBeDefined();
      expect(["Good", "Fair", "Poor", "Critical"]).toContain(review.executiveSummary.projectHealth);
      expect(review.executiveSummary.overallAssessment).toBeTruthy();
      expect(review.executiveSummary.keyStrengths.length).toBeGreaterThan(0);
      expect(review.executiveSummary.keyConcerns.length).toBeGreaterThan(0);

      // 2. Project Understanding
      expect(review.projectUnderstanding).toBeDefined();
      expect(review.projectUnderstanding.objectivesAndScope).toContain("28.5");
      expect(review.projectUnderstanding.expectedOutcomes.length).toBeGreaterThan(0);
      expect(review.projectUnderstanding.currentProgress).toContain("Planning");
      expect(review.projectUnderstanding.budgetAndTimelineContext).toContain("4,200");
      expect(review.projectUnderstanding.assumptions.length).toBeGreaterThan(0);

      // 3. Progress and Performance Analysis
      expect(review.progressPerformance).toBeDefined();
      expect(review.progressPerformance.milestoneAnalysis.length).toBeGreaterThan(0);
      expect(review.progressPerformance.plannedVsActual).toBeTruthy();
      expect(review.progressPerformance.schedulePerformance).toBeTruthy();
      expect(review.progressPerformance.budgetUtilization).toBeTruthy();
      expect(review.progressPerformance.bottlenecksAndDelays.length).toBeGreaterThan(0);

      // 4. Risk Assessment
      expect(review.riskAssessment).toBeDefined();
      expect(review.riskAssessment.length).toBeGreaterThan(0);
      review.riskAssessment.forEach((risk) => {
        expect(risk.risk).toBeTruthy();
        expect(risk.likelihood).toBeTruthy();
        expect(risk.impact).toBeTruthy();
        expect(["Low", "Moderate", "High", "Critical"]).toContain(risk.severity);
        expect(risk.supportingEvidence).toBeTruthy();
        expect(risk.mitigation).toBeTruthy();
        expect(risk.recommendedOwner).toBeTruthy();
      });

      // 5. Budget and Resource Analysis
      expect(review.budgetAndResources).toBeDefined();
      expect(review.budgetAndResources.allocationAndUtilization.length).toBeGreaterThan(0);
      expect(review.budgetAndResources.resourceConstraints.length).toBeGreaterThan(0);
      expect(review.budgetAndResources.optimizationOpportunities.length).toBeGreaterThan(0);
      expect(review.budgetAndResources.figuresNote).toContain("verified");

      // 6. Technical and Operational Assessment
      expect(review.technicalAndOperational).toBeDefined();
      expect(review.technicalAndOperational.technicalFeasibility).toBeTruthy();
      expect(review.technicalAndOperational.implementationConcerns.length).toBeGreaterThan(0);
      expect(review.technicalAndOperational.dependencies.length).toBeGreaterThan(0);
      expect(review.technicalAndOperational.operationalReadiness).toBeTruthy();
      expect(review.technicalAndOperational.qualityConsiderations.length).toBeGreaterThan(0);

      // 7. Recommendations
      expect(review.recommendations).toBeDefined();
      expect(review.recommendations.length).toBeGreaterThan(0);
      review.recommendations.forEach((rec) => {
        expect(rec.title).toBeTruthy();
        expect(["Critical", "High", "Medium", "Low"]).toContain(rec.priority);
        expect(["Immediate", "Near-term", "Long-term"]).toContain(rec.urgency);
        expect(rec.whyItMatters).toBeTruthy();
        expect(rec.expectedBenefit).toBeTruthy();
        expect(rec.implementationApproach).toBeTruthy();
      });

      // 8. Action Plan
      expect(review.actionPlan).toBeDefined();
      expect(review.actionPlan.immediateActions.length).toBeGreaterThan(0);
      expect(review.actionPlan.shortTermActions.length).toBeGreaterThan(0);
      expect(review.actionPlan.mediumTermActions.length).toBeGreaterThan(0);
      [...review.actionPlan.immediateActions, ...review.actionPlan.shortTermActions].forEach((action) => {
        expect(action.action).toBeTruthy();
        expect(action.owner).toBeTruthy();
        expect(action.expectedOutcome).toBeTruthy();
      });

      // 9. Conclusion
      expect(review.conclusion).toBeDefined();
      expect(review.conclusion.outlook).toBeTruthy();
      expect(review.conclusion.criticalIssues.length).toBeGreaterThan(0);
      expect(review.conclusion.nextSteps.length).toBeGreaterThan(0);
    });

    it("does NOT invent unrecorded financial data and includes figures note", () => {
      const projectWithoutBudget: Project = {
        ...demoProject,
        budgetCrore: 0,
      };

      const result = buildDemoAnalysis(projectWithoutBudget, "Test brief", []);
      expect(result.detailedReview?.budgetAndResources.figuresNote).toBeTruthy();
      expect(result.detailedReview?.budgetAndResources.allocationAndUtilization.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Section 2: Live Gemini AI Review via POST /api/ai/analyze
  // =========================================================================
  describe("Live Gemini Review via /api/ai/analyze", () => {
    const mockFullGeminiReview = {
      executiveSummary: "The Metro Phase 3 project demonstrates strong strategic alignment with suburban transit corridors.",
      detailedReview: {
        executiveSummary: {
          overallAssessment: "The Metro Phase 3 project demonstrates strong strategic alignment with suburban transit corridors.",
          projectHealth: "Good",
          healthExplanation: "Sound corridor demand and capital alignment.",
          keyStrengths: ["Strong transit corridor demand", "Sound preliminary civil alignment"],
          keyConcerns: ["Depot acquisition timeline critical", "Utility diversion dependencies"],
        },
        projectUnderstanding: {
          objectivesAndScope: "Construct 28.5km grade-separated metro with 22 stations.",
          expectedOutcomes: ["320,000 daily boardings", "22-minute peak travel time savings"],
          currentProgress: "18% complete across preliminary design and statutory filings.",
          budgetAndTimelineContext: "Envelope of ₹4,200 Cr with 2030 target commercial operation.",
          assumptions: ["Soil conditions consistent with geotech bores", "33kV grid feeder reliability"],
        },
        progressPerformance: {
          milestoneAnalysis: [
            { phase: "Detailed Project Report", window: "Months 0-6", status: "Completed", detail: "Approved ahead of schedule" },
          ],
          plannedVsActual: "Tracking on target with minor utility diversion variance.",
          schedulePerformance: "SPI estimated at 0.98.",
          budgetUtilization: "CPI estimated at 1.01 with ₹380 Cr expended to date.",
          bottlenecksAndDelays: ["Statutory environmental clearance for wetland crossing"],
        },
        riskAssessment: [
          {
            risk: "Land acquisition dispute at depot location",
            likelihood: "Moderate",
            impact: "High",
            severity: "High",
            supportingEvidence: "Two title petitions pending in municipal tribunal.",
            mitigation: "Milestone-based compensation escrow and alternate parcel survey.",
            recommendedOwner: "Chief Land Officer",
          },
        ],
        budgetAndResources: {
          allocationAndUtilization: [
            { component: "Civil works", valueCrore: 2600, note: "62% of capex" },
          ],
          potentialOverruns: "Steel price escalation clauses pose ₹45 Cr risk.",
          resourceConstraints: ["Specialized underground TBM operating crews"],
          optimizationOpportunities: ["Standardized precast segmental girder design"],
          figuresNote: "All figures grounded in RealityOS project register telemetry.",
        },
        technicalAndOperational: {
          technicalFeasibility: "CBTC GOA4 automated signaling proven on similar grade profiles.",
          implementationConcerns: ["Deep station excavation adjacent to water main"],
          dependencies: [
            { item: "Utility diversion design freeze", criticality: "High", note: "Prerequisite for pier piling." },
          ],
          operationalReadiness: "Maintenance staffing required 9 months before opening.",
          qualityConsiderations: ["Concrete core testing per IS 456 requirements"],
        },
        recommendations: [
          {
            title: "Ring-fence 12% contingency margin for underground civil risks",
            priority: "High",
            urgency: "Immediate",
            whyItMatters: "Early design evolution historically erodes financial cushion.",
            expectedBenefit: "Preserves target debt service coverage ratio.",
            implementationApproach: "Executive committee approval required for any contingency draw.",
          },
        ],
        actionPlan: {
          immediateActions: [
            { action: "Execute utility diversion design freeze", owner: "Chief Engineer", expectedOutcome: "Signed IFC drawings issued" },
          ],
          shortTermActions: [
            { action: "Issue pre-qualification for TBM packages", owner: "Procurement Lead", expectedOutcome: "Bids received from 3 qualified consortia" },
          ],
          mediumTermActions: [
            { action: "Complete substation land handover", owner: "Land Acquisition Officer", expectedOutcome: "Physical possession order granted" },
          ],
        },
        conclusion: {
          outlook: "Positive with manageable technical and statutory execution risks.",
          criticalIssues: ["Depot land acquisition", "Utility diversion clearance"],
          nextSteps: ["Issue utility work orders", "Convene inter-agency taskforce"],
        },
      },
    };

    it("successfully validates and structures full 9-section review from Gemini response", async () => {
      const auth = createMockAuthenticatedContext("editor");
      setApiAuthResult(auth);
      process.env.GEMINI_API_KEY = "mock-gemini-key";

      // Mock DB: Project lookup
      db.queueResult([
        createMockProjectRow({
          id: "PRJ-1001",
          name: "Metro Phase 3 South",
          budgetCrore: 4200,
        }),
      ]);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify(mockFullGeminiReview),
                  },
                ],
              },
            },
          ],
        }),
      });

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: {
          projectId: "PRJ-1001",
          requirements: "Build 28.5km automated metro line.",
        },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.analysis.mode).toBe("live");
      expect(data.analysis.detailedReview).toBeDefined();
      const review = data.analysis.detailedReview;
      expect(review.executiveSummary.projectHealth).toBe("Good");
      expect(review.projectUnderstanding.objectivesAndScope).toContain("28.5km");
      expect(review.riskAssessment[0].risk).toContain("Land acquisition");
      expect(review.actionPlan.immediateActions[0].action).toContain("utility diversion");
      expect(review.conclusion.outlook).toContain("Positive");

      // Verify backwards compatibility with agent findings
      expect(data.analysis.agents.length).toBe(5);
      expect(data.analysis.costs.length).toBeGreaterThan(0);
    });

    it("handles project with missing budget/milestones without inventing numbers", async () => {
      const auth = createMockAuthenticatedContext("editor");
      setApiAuthResult(auth);
      process.env.GEMINI_API_KEY = "mock-gemini-key";

      // Project with 0 budget and no milestones
      db.queueResult([
        createMockProjectRow({
          id: "PRJ-EMPTY",
          name: "Unfunded Feasibility Corridor",
          budgetCrore: 0,
        }),
      ]);
      db.queueResult([]); // 0 milestones
      db.queueResult([]); // 0 risks

      let promptSent = "";
      globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
        promptSent = init?.body ? JSON.parse(init.body).contents[0].parts[0].text : "";
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify(mockFullGeminiReview),
                    },
                  ],
                },
              },
            ],
          }),
        };
      });

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: {
          projectId: "PRJ-EMPTY",
          requirements: "Feasibility study for suburban transit route.",
        },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(200);
      expect(promptSent).toContain("Unrecorded in project register");
      expect(promptSent).toContain("Capital Budget Envelope: ₹Unrecorded");
    });

    it("handles malformed Gemini response with 502 Bad Gateway without leaking keys", async () => {
      const auth = createMockAuthenticatedContext("editor");
      setApiAuthResult(auth);
      process.env.GEMINI_API_KEY = "super-secret-key-12345";

      db.queueResult([]);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "```json\n{ this is corrupted json that cannot be parsed ...\n```",
                  },
                ],
              },
            },
          ],
        }),
      });

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: {
          requirements: "Construct regional heavy rail bypass.",
        },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(502);
      const data = await res.json();
      expect(data.error).toContain("Gemini response was not valid JSON");
      expect(JSON.stringify(data)).not.toContain("super-secret-key-12345");
    });

    it("handles Gemini 429 rate limit error gracefully", async () => {
      const auth = createMockAuthenticatedContext("editor");
      setApiAuthResult(auth);
      process.env.GEMINI_API_KEY = "super-secret-key-12345";

      db.queueResult([]);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Resource exhausted: rate limit exceeded quota per minute",
      });

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: {
          requirements: "High capacity mass transit line.",
        },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toContain("Gemini rate limit reached");
      expect(JSON.stringify(data)).not.toContain("super-secret-key-12345");
    });

    it("handles Gemini timeout (AbortError) with 502 Bad Gateway", async () => {
      const auth = createMockAuthenticatedContext("editor");
      setApiAuthResult(auth);
      process.env.GEMINI_API_KEY = "super-secret-key-12345";

      db.queueResult([]);

      globalThis.fetch = vi.fn().mockRejectedValue(
        Object.assign(new Error("Request timed out"), { name: "AbortError" })
      );

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/ai/analyze",
        method: "POST",
        body: {
          requirements: "High speed passenger link.",
        },
      });

      const res = await postAiAnalyze(req);
      expect(res.status).toBe(502);
      const data = await res.json();
      expect(data.error).toContain("Gemini request timed out after 30s");
      expect(JSON.stringify(data)).not.toContain("super-secret-key-12345");
    });
  });

  // =========================================================================
  // Section 3: Report Builder & PDF Export Integration
  // =========================================================================
  describe("Report Conversion and PDF Generation with Detailed Review", () => {
    const demoProject: Project = {
      id: "PRJ-DEMO-TEST",
      name: "Metro Phase 3 South",
      description: "28.5km suburban rapid transit corridor connecting suburban hubs",
      infraType: "Rail & Transit",
      region: "South Corridor",
      status: "Planning",
      budgetCrore: 4200,
      targetCompletion: "2030-12-31",
      corridorKm: 28.5,
      stations: 22,
      riskLevel: "Moderate",
      capacityTarget: "500,000 daily commuters",
      sustainabilityPriorities: ["Solar roofs", "Energy storage"],
      requirements: "CBTC automation",
      featured: false,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it("reportFromAnalysis maps detailedReview into ReportContent", () => {
      const analysis = buildDemoAnalysis(demoProject, "Automated rail brief", ["Control cost"]);
      const content = reportFromAnalysis(analysis);

      expect(content.detailedReview).toBeDefined();
      expect(content.detailedReview?.executiveSummary.projectHealth).toBe(
        analysis.detailedReview?.executiveSummary.projectHealth
      );
      expect(content.detailedReview?.recommendations.length).toBe(
        analysis.detailedReview?.recommendations.length
      );
      expect(content.detailedReview?.actionPlan.immediateActions.length).toBe(
        analysis.detailedReview?.actionPlan.immediateActions.length
      );
    });

    it("exportReportPdf exports report with detailedReview without throwing errors", () => {
      const analysis = buildDemoAnalysis(demoProject, "Automated rail brief", ["Control cost"]);
      const content = reportFromAnalysis(analysis);
      const report: Report = {
        id: "RPT-DEMO-1",
        title: "Metro Phase 3 Executive Review",
        projectId: demoProject.id,
        reportType: "Planning Analysis",
        status: "Draft",
        content,
        createdAt: new Date().toISOString(),
      };

      expect(() => {
        exportReportPdf(report, demoProject);
      }).not.toThrow();
    });
  });
});
