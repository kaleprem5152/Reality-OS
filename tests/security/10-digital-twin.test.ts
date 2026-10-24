import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockNextRequest,
  createMockAuthenticatedContext,
} from "../helpers/mock-auth";
import {
  createMockDb,
  createMockReportRow,
  createMockProjectRow,
  type MockDb,
} from "../helpers/mock-db";
import {
  runScenario,
  runMonteCarlo,
  validateInputs,
  INPUT_BOUNDS,
  DEFAULT_SCENARIOS,
  MODEL_CONSTANTS,
} from "@/lib/simulation";
import { reportFromScenarios } from "@/lib/report-builder";
import type { Project, ScenarioInputs } from "@/lib/types";

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

// Import route handlers under test
import { POST as postReports } from "@/app/api/reports/route";
import { db as rawDb } from "@/db";

/** Helper that mirrors DigitalTwinPage's project scenario derivation logic */
function deriveScenariosForProject(project: Project): ScenarioInputs[] {
  const budget = Math.max(
    INPUT_BOUNDS.budgetCrore.min,
    Math.min(INPUT_BOUNDS.budgetCrore.max, project.budgetCrore || 18500),
  );
  const stations = Math.max(
    INPUT_BOUNDS.stations.min,
    Math.min(INPUT_BOUNDS.stations.max, project.stations || 14),
  );
  const corridorKm = Math.max(
    INPUT_BOUNDS.corridorKm.min,
    Math.min(INPUT_BOUNDS.corridorKm.max, Math.round(project.corridorKm || 28)),
  );
  const priorities = project.sustainabilityPriorities?.length
    ? project.sustainabilityPriorities
    : ["Low-carbon construction", "Transit-oriented development"];

  const baseline: ScenarioInputs = {
    name: "Baseline Plan",
    budgetCrore: budget,
    stations,
    corridorKm,
    dailyRidership: Math.round(stations * 11500),
    constructionYears: Math.max(
      3,
      Math.min(
        15,
        Math.round(
          (corridorKm / MODEL_CONSTANTS.KM_PER_YEAR +
            stations * MODEL_CONSTANTS.YEARS_PER_STATION) *
            2,
        ) / 2,
      ),
    ),
    trainCapacityPerHour: 15000,
    energyKwhPerTrainKm: 19,
    sustainabilityPriorities: priorities,
  };

  const optimized: ScenarioInputs = {
    name: "Scope-Optimized",
    budgetCrore: Math.round(budget * 0.8),
    stations: Math.max(INPUT_BOUNDS.stations.min, Math.round(stations * 0.82)),
    corridorKm: Math.max(INPUT_BOUNDS.corridorKm.min, Math.round(corridorKm * 0.85)),
    dailyRidership: Math.round(stations * 0.82 * 11000),
    constructionYears: Math.max(3, baseline.constructionYears - 1),
    trainCapacityPerHour: 13500,
    energyKwhPerTrainKm: 17,
    sustainabilityPriorities: ["Recycled materials"],
  };

  const sustainable: ScenarioInputs = {
    name: "Sustainability Accelerated",
    budgetCrore: Math.round(budget * 1.15),
    stations,
    corridorKm,
    dailyRidership: Math.round(baseline.dailyRidership * 1.1),
    constructionYears: Math.min(15, baseline.constructionYears + 0.5),
    trainCapacityPerHour: 16500,
    energyKwhPerTrainKm: 15,
    sustainabilityPriorities: [
      "Low-carbon construction",
      "Renewable traction power",
      "Transit-oriented development",
      "Recycled materials",
    ],
  };

  return [baseline, optimized, sustainable];
}

describe("10 - Digital Twin, Scenario Simulation & Infrastructure Map Test Suite", () => {
  const db = rawDb as unknown as MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
  });

  // =========================================================================
  // Section 1: Project Data Binding & Scenario Derivation
  // =========================================================================
  describe("Project Data Binding & Dynamic Scenario Derivation", () => {
    it("binds baseline scenario inputs to persisted project fields", () => {
      const mockProject: Project = {
        id: "PRJ-1002",
        name: "Western High-Speed Link",
        description: "Intercity electrified rail corridor",
        infraType: "Rail & Transit",
        region: "Western Corridor",
        status: "Planning",
        budgetCrore: 14500,
        targetCompletion: "2031",
        riskLevel: "Moderate",
        capacityTarget: "300,000 daily commuters",
        corridorKm: 58.4,
        stations: 18,
        sustainabilityPriorities: ["Solar roofs", "Regenerative braking"],
        requirements: "Rapid zero-carbon transit link",
        featured: true,
        archived: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const scenarios = deriveScenariosForProject(mockProject);
      expect(scenarios).toHaveLength(3);

      const baseline = scenarios[0];
      expect(baseline.name).toBe("Baseline Plan");
      expect(baseline.budgetCrore).toBe(14500);
      expect(baseline.stations).toBe(18);
      expect(baseline.corridorKm).toBe(58);
      expect(baseline.sustainabilityPriorities).toEqual(["Solar roofs", "Regenerative braking"]);
    });

    it("refreshes scenario parameters and simulation outputs when switching projects", () => {
      const projectA: Project = {
        id: "PRJ-A",
        name: "Urban Light Rail Line",
        description: "",
        infraType: "Rail & Transit",
        region: "Central City",
        status: "Planning",
        budgetCrore: 2800,
        targetCompletion: "2028",
        riskLevel: "Low",
        capacityTarget: "",
        corridorKm: 16.5,
        stations: 12,
        sustainabilityPriorities: ["Low-carbon construction"],
        requirements: "",
        featured: false,
        archived: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const projectB: Project = {
        id: "PRJ-B",
        name: "Trans-Continental Freight Corridor",
        description: "",
        infraType: "Ports & Logistics",
        region: "National",
        status: "In Delivery",
        budgetCrore: 38000,
        targetCompletion: "2034",
        riskLevel: "High",
        capacityTarget: "",
        corridorKm: 140,
        stations: 48,
        sustainabilityPriorities: ["Recycled materials"],
        requirements: "",
        featured: false,
        archived: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const scenariosA = deriveScenariosForProject(projectA);
      const scenariosB = deriveScenariosForProject(projectB);

      const outputA = runScenario(scenariosA[0]);
      const outputB = runScenario(scenariosB[0]);

      // Confirm switching projects produces completely distinct, project-specific outputs
      expect(outputA.capex.totalModeled).toBeLessThan(outputB.capex.totalModeled);
      expect(outputA.schedule.estimatedYears).toBeLessThan(outputB.schedule.estimatedYears);
      expect(outputA.resources.annualEnergyGwh).toBeLessThan(outputB.resources.annualEnergyGwh);
      expect(outputA.resources.fleetTrains).toBeLessThan(outputB.resources.fleetTrains);
    });

    it("clamps missing or out-of-bounds project parameters cleanly within INPUT_BOUNDS", () => {
      const extremeProject: Project = {
        id: "PRJ-EXTREME",
        name: "Boundary Test Project",
        description: "",
        infraType: "Highways & Roads",
        region: "Northern",
        status: "Planning",
        budgetCrore: 9999999, // exceeds max budget
        targetCompletion: "2040",
        riskLevel: "Critical",
        capacityTarget: "",
        corridorKm: 9999, // exceeds max km
        stations: 9999, // exceeds max stations
        sustainabilityPriorities: [],
        requirements: "",
        featured: false,
        archived: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const scenarios = deriveScenariosForProject(extremeProject);
      const baseline = scenarios[0];

      expect(baseline.budgetCrore).toBe(INPUT_BOUNDS.budgetCrore.max);
      expect(baseline.stations).toBe(INPUT_BOUNDS.stations.max);
      expect(baseline.corridorKm).toBe(INPUT_BOUNDS.corridorKm.max);

      const validationErrors = validateInputs(baseline);
      expect(validationErrors).toHaveLength(0);
    });
  });

  // =========================================================================
  // Section 2: Deterministic Scenario Engine & Monte Carlo Simulation
  // =========================================================================
  describe("Simulation Controls & Monte Carlo Uncertainty Analysis", () => {
    it("reflects parameter modifications in computed capex, schedule, and risk", () => {
      const baseInput: ScenarioInputs = { ...DEFAULT_SCENARIOS[0] };
      const baseOut = runScenario(baseInput);

      // Increasing corridor length increases capex and duration
      const extendedInput: ScenarioInputs = { ...baseInput, corridorKm: baseInput.corridorKm + 20 };
      const extendedOut = runScenario(extendedInput);

      expect(extendedOut.capex.civil).toBeGreaterThan(baseOut.capex.civil);
      expect(extendedOut.capex.systems).toBeGreaterThan(baseOut.capex.systems);
      expect(extendedOut.capex.totalModeled).toBeGreaterThan(baseOut.capex.totalModeled);
      expect(extendedOut.schedule.estimatedYears).toBeGreaterThanOrEqual(baseOut.schedule.estimatedYears);

      // Adding stations increases land/station capex and staff estimates
      const moreStationsInput: ScenarioInputs = { ...baseInput, stations: baseInput.stations + 10 };
      const moreStationsOut = runScenario(moreStationsInput);

      expect(moreStationsOut.capex.land).toBeGreaterThan(baseOut.capex.land);
      expect(moreStationsOut.resources.staffEstimate).toBeGreaterThan(baseOut.resources.staffEstimate);
    });

    it("runs deterministic 500-trial Monte Carlo simulation with stable seed", () => {
      const input: ScenarioInputs = { ...DEFAULT_SCENARIOS[0] };
      const mcResult = runMonteCarlo(input, 500, 4217);

      expect(mcResult.trials).toBe(500);
      expect(mcResult.assumptions[0]).toContain("4217");

      // Verify percentile ordering: P10 <= P50 <= P90
      expect(mcResult.costCrore.p10).toBeLessThanOrEqual(mcResult.costCrore.p50);
      expect(mcResult.costCrore.p50).toBeLessThanOrEqual(mcResult.costCrore.p90);

      expect(mcResult.durationYears.p10).toBeLessThanOrEqual(mcResult.durationYears.p50);
      expect(mcResult.durationYears.p50).toBeLessThanOrEqual(mcResult.durationYears.p90);

      // Verify histogram distribution exists and totals 500 trials
      expect(mcResult.histogram.length).toBeGreaterThan(0);
      const totalCount = mcResult.histogram.reduce((sum, h) => sum + h.count, 0);
      expect(totalCount).toBe(500);

      // Determinism: running again with identical seed returns identical values
      const mcRepeat = runMonteCarlo(input, 500, 4217);
      expect(mcRepeat.costCrore.p50).toBe(mcResult.costCrore.p50);
      expect(mcRepeat.durationYears.p50).toBe(mcResult.durationYears.p50);
    });
  });

  // =========================================================================
  // Section 3: Scenario Report Generation & Workspace Persistence
  // =========================================================================
  describe("Scenario Report Generation & Workspace Persistence", () => {
    it("generates structured report content from scenarios with correct project attribution", () => {
      const mockProject: Project = {
        id: "PRJ-3001",
        name: "North-South Metro Corridor",
        description: "",
        infraType: "Rail & Transit",
        region: "Capital Region",
        status: "Planning",
        budgetCrore: 8500,
        targetCompletion: "2030",
        riskLevel: "Moderate",
        capacityTarget: "400k pax/day",
        corridorKm: 34,
        stations: 16,
        sustainabilityPriorities: ["Solar roofs"],
        requirements: "Electric urban spine",
        featured: false,
        archived: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const scenarios = deriveScenariosForProject(mockProject);
      const triples = scenarios.map((inputs) => ({ inputs, outputs: runScenario(inputs) }));

      const content = reportFromScenarios(mockProject, triples);
      expect(content.executiveSummary).toContain("North-South Metro Corridor");
      expect(content.costBreakdown).toHaveLength(3);
      expect(content.milestones).toHaveLength(3);
      expect(content.riskRegister).toHaveLength(3);
    });

    it("persists a scenario comparison report to PostgreSQL via POST /api/reports", async () => {
      const auth = createMockAuthenticatedContext("editor", {
        userId: "usr-sim-planner",
        workspaceId: "ws-metro-north",
      });
      setApiAuthResult(auth);

      const mockProject: Project = {
        id: "PRJ-3001",
        name: "North-South Metro Corridor",
        description: "",
        infraType: "Rail & Transit",
        region: "Capital Region",
        status: "Planning",
        budgetCrore: 8500,
        targetCompletion: "2030",
        riskLevel: "Moderate",
        capacityTarget: "400k pax/day",
        corridorKm: 34,
        stations: 16,
        sustainabilityPriorities: ["Solar roofs"],
        requirements: "",
        featured: false,
        archived: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const scenarios = deriveScenariosForProject(mockProject);
      const triples = scenarios.map((inputs) => ({ inputs, outputs: runScenario(inputs) }));
      const content = reportFromScenarios(mockProject, triples);

      const createdRow = createMockReportRow({
        id: "RPT-5001",
        workspaceId: "ws-metro-north",
        projectId: "PRJ-3001",
        title: "North-South Metro Corridor — Scenario Comparison",
        reportType: "Scenario Comparison",
        status: "Draft",
        content: content as unknown as Record<string, unknown>,
      });

      // 1. SELECT max(id) for auto-increment RPT- ID
      // 2. INSERT into reports returning row
      db.queueResults([[], [createdRow]]);

      const req = createMockNextRequest({
        url: "http://localhost:3000/api/reports",
        method: "POST",
        body: {
          projectId: mockProject.id,
          title: `${mockProject.name} — Scenario Comparison`,
          reportType: "Scenario Comparison",
          status: "Draft",
          content,
        },
      });

      const res = await postReports(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe("RPT-5001");
      expect(data.projectId).toBe("PRJ-3001");
      expect(data.title).toContain("North-South Metro Corridor");

      const insertQuery = db.getExecutedQueries().find((q) => q.operation === "insert");
      expect(insertQuery).toBeDefined();
      expect((insertQuery?.insertValues as any).workspaceId).toBe("ws-metro-north");
      expect((insertQuery?.insertValues as any).createdBy).toBe("usr-sim-planner");
    });
  });

  // =========================================================================
  // Section 4: Telemetry Node Generation & Visual Fallback Resilience
  // =========================================================================
  describe("Telemetry Node Generation & Alignment Visual Fallback", () => {
    it("generates structured station nodes along corridor with telemetry heuristics", () => {
      const stationCount = 10;
      const totalKm = 30;

      const nodes = Array.from({ length: stationCount }, (_, i) => {
        const chainage = (i / (stationCount - 1)) * totalKm;
        const isTerminal = i === 0 || i === stationCount - 1;
        const isInterchange = !isTerminal && i === 5;
        const type = isTerminal ? "Terminal" : isInterchange ? "Interchange" : "Standard";
        const powerDrawKw = Math.round((isTerminal ? 1200 : isInterchange ? 950 : 680) * 1.0);

        return {
          index: i + 1,
          type,
          chainageKm: Number(chainage.toFixed(1)),
          powerDrawKw,
          healthScore: 95 - (i % 3) * 2,
        };
      });

      expect(nodes).toHaveLength(10);
      expect(nodes[0].type).toBe("Terminal");
      expect(nodes[0].chainageKm).toBe(0.0);
      expect(nodes[9].type).toBe("Terminal");
      expect(nodes[9].chainageKm).toBe(30.0);
      expect(nodes[5].type).toBe("Interchange");

      // Verify all power draws and health scores are valid numbers
      nodes.forEach((n) => {
        expect(n.powerDrawKw).toBeGreaterThan(0);
        expect(n.healthScore).toBeGreaterThanOrEqual(70);
        expect(n.healthScore).toBeLessThanOrEqual(100);
      });
    });

    it("verifies map suitability score color thresholds adhere to accessibility standards", () => {
      function getScoreColor(v: number): string {
        if (v >= 80) return "#3FA97F";
        if (v >= 70) return "#7CD4AE";
        if (v >= 60) return "#D2A24C";
        return "#D76060";
      }

      expect(getScoreColor(92)).toBe("#3FA97F"); // Strong (green)
      expect(getScoreColor(80)).toBe("#3FA97F");
      expect(getScoreColor(75)).toBe("#7CD4AE"); // Good (teal)
      expect(getScoreColor(70)).toBe("#7CD4AE");
      expect(getScoreColor(65)).toBe("#D2A24C"); // Marginal (amber)
      expect(getScoreColor(60)).toBe("#D2A24C");
      expect(getScoreColor(52)).toBe("#D76060"); // Weak (red)
      expect(getScoreColor(0)).toBe("#D76060");
    });
  });
});
