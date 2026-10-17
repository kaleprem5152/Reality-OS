/* RealityOS domain types — single source of truth for the prototype dataset. */

export type InfraType =
  | "Rail & Transit"
  | "Highways & Roads"
  | "Water & Utilities"
  | "Energy Grid"
  | "Airports"
  | "Ports & Logistics"
  | "Digital Infrastructure"
  | "Flood & Coastal";

export type ProjectStatus =
  | "Scenario Evaluation"
  | "Planning"
  | "In Review"
  | "Approved"
  | "In Delivery"
  | "On Hold"
  | "Archived";

export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";

export interface Project {
  id: string;
  name: string;
  description: string;
  infraType: InfraType;
  region: string;
  status: ProjectStatus;
  /** Estimated budget in ₹ crore */
  budgetCrore: number;
  targetCompletion: string;
  riskLevel: RiskLevel;
  capacityTarget: string;
  sustainabilityPriorities: string[];
  requirements: string;
  stations?: number | null;
  corridorKm?: number | null;
  featured: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  id: string;
  projectId: string;
  title: string;
  reportType:
    | "Planning Analysis"
    | "Scenario Comparison"
    | "Risk Assessment"
    | "Environmental Review";
  status: "Draft" | "Final";
  content: ReportContent;
  createdAt: string;
}

export interface ReportContent {
  executiveSummary: string;
  assumptions: string[];
  costBreakdown: { label: string; valueCrore: number; note?: string }[];
  milestones: { phase: string; window: string; detail: string }[];
  riskRegister: { risk: string; severity: RiskLevel; mitigation: string }[];
  environmental: string[];
  recommendations: { title: string; rationale: string }[];
  evidence: { label: string; kind: "Illustrative" | "Internal analysis" }[];
}

/* ---------------------------- Metro schematic ---------------------------- */

export interface Station {
  id: string; // e.g. "ST-01"
  code: string; // e.g. "CEN"
  name: string;
  line: "Line A" | "Line B" | "Both";
  /** Octolinear schematic coordinates (NOT geographic). */
  x: number;
  y: number;
  /** Preferred label anchor on the schematic. */
  labelPos: "top" | "bottom" | "left" | "right";
  /** Geo coordinates for the Geo page (spread around a fictional metro). */
  lat: number;
  lng: number;
  type: "Standard" | "Interchange" | "Terminal";
  catchment: string;
  dailyRidership: number; // illustrative
  suitability?: Suitability; // illustrative candidate scoring
}

export interface Suitability {
  overall: number;
  accessibility: number;
  populationCoverage: number;
  transitProximity: number;
  environmental: number;
  landUse: number;
  note: string;
}

export interface Corridor {
  id: string; // e.g. "COR-A"
  name: string;
  line: "Line A" | "Line B";
  points: string[]; // station ids in order
  lengthKm: number;
  status: "Proposed" | "Under study";
  description: string;
}

/* ------------------------------ Simulation ------------------------------ */

export interface ScenarioInputs {
  name: string;
  budgetCrore: number;
  stations: number;
  corridorKm: number;
  dailyRidership: number; // passengers/day
  constructionYears: number;
  trainCapacityPerHour: number; // per direction
  energyKwhPerTrainKm: number;
  sustainabilityPriorities: string[];
}

export interface ScenarioOutputs {
  capex: {
    civil: number;
    systems: number;
    rollingStock: number;
    land: number;
    contingency: number;
    totalModeled: number;
    budgetUtilizationPct: number;
    withinBudget: boolean;
  };
  schedule: {
    estimatedYears: number;
    schedulePressurePct: number;
  };
  demand: {
    dailyCapacityOffered: number;
    demandCoveragePct: number;
    peakCrowdingIndex: number;
  };
  resources: {
    annualEnergyGwh: number;
    fleetTrains: number;
    staffEstimate: number;
  };
  risk: {
    score: number; // 0–100
    level: RiskLevel;
    drivers: string[];
  };
  sustainability: {
    score: number; // 0–100
    co2AvoidedTonsPerYear: number;
    renewableSharePct: number;
  };
}

export interface MonteCarloResult {
  trials: number;
  costCrore: { p10: number; p50: number; p90: number };
  durationYears: { p10: number; p50: number; p90: number };
  histogram: { bucket: string; count: number }[];
  assumptions: string[];
}

/* ---------------------------- Planning studio ---------------------------- */

export interface AgentFinding {
  agent:
    | "Transportation Planning"
    | "Financial Analysis"
    | "Environmental Assessment"
    | "Utilities & Dependencies"
    | "Risk Analysis";
  summary: string;
  findings: string[];
  metrics: { label: string; value: string }[];
}

export interface AnalysisResult {
  mode: "demo" | "live";
  projectId: string;
  projectName: string;
  generatedAt: string;
  executiveSummary: string;
  agents: AgentFinding[];
  recommendations: { title: string; rationale: string }[];
  costs: { label: string; valueCrore: number; note?: string }[];
  deliveryConsiderations: string[];
  environmentalConstraints: string[];
  dependencies: { item: string; criticality: RiskLevel; note: string }[];
  risks: { risk: string; severity: RiskLevel; mitigation: string }[];
  confidence: { score: number; explanation: string };
  assumptions: string[];
  evidence: { label: string; kind: "Illustrative" | "Internal analysis" }[];
}

/* ----------------------------- Knowledge graph ----------------------------- */

export type GraphNodeType =
  | "Project"
  | "Station"
  | "Corridor"
  | "Utility"
  | "Budget"
  | "Environmental Constraint"
  | "Regulation"
  | "Dependency"
  | "Risk";

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  x: number;
  y: number;
  detail: string;
  meta?: { label: string; value: string }[];
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  explanation: string;
}

/* --------------------------------- Settings -------------------------------- */

export interface AppSettings {
  currency: "INR" | "USD";
  defaultStations: number;
  defaultCorridorKm: number;
  defaultBudgetCrore: number;
  defaultYears: number;
  mapDefaultLayer: "streets" | "light";
  mapShowLabels: boolean;
  compactTables: boolean;
}

/* --------------------------------- Activity -------------------------------- */

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  kind: "project" | "simulation" | "analysis" | "report" | "geo";
}
