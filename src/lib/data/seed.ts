import type { ActivityItem, Project, ProjectStatus } from "@/lib/types";

/**
 * Illustrative demo dataset for the RealityOS prototype.
 * Every figure here is fictional and intended only to demonstrate workflows.
 */

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 864e5).toISOString();

export const SEED_PROJECTS: Project[] = [
  {
    id: "PRJ-1001",
    name: "Metro Intelligence",
    description:
      "Proposed metropolitan rail network: two trunk corridors, 42 stations and 68 km of alignment under scenario evaluation. Demonstration project for the RealityOS planning workflow.",
    infraType: "Rail & Transit",
    region: "Northern Metro Region",
    status: "Scenario Evaluation",
    budgetCrore: 18500,
    targetCompletion: "2032",
    riskLevel: "High",
    capacityTarget: "480,000 daily passengers by opening year",
    sustainabilityPriorities: ["Low-carbon construction", "Renewable traction power", "Transit-oriented development"],
    requirements:
      "Plan a metropolitan rail network with 42 proposed stations and 68 km of corridor. Optimize accessibility, capital cost, construction time, environmental impact, and integration with existing public transport.",
    stations: 42,
    corridorKm: 68,
    featured: true,
    archived: false,
    createdAt: daysAgo(96),
    updatedAt: daysAgo(2),
  },
  {
    id: "PRJ-1002",
    name: "Western Coastal Highway Corridor",
    description: "84 km access-controlled coastal expressway with three interchange nodes and a tidal-zone viaduct section.",
    infraType: "Highways & Roads",
    region: "Western Coastal Belt",
    status: "In Review",
    budgetCrore: 9200,
    targetCompletion: "2030",
    riskLevel: "Moderate",
    capacityTarget: "60,000 vehicles/day design capacity",
    sustainabilityPriorities: ["Mangrove impact mitigation", "Recycled pavement materials"],
    requirements:
      "Evaluate an 84 km coastal expressway alignment minimizing ecological disturbance while meeting projected freight and passenger demand.",
    stations: null,
    corridorKm: 84,
    featured: false,
    archived: false,
    createdAt: daysAgo(210),
    updatedAt: daysAgo(6),
  },
  {
    id: "PRJ-1003",
    name: "City Ring Water Grid Modernization",
    description: "Replacement of 310 km of trunk mains, smart metering rollout, and NRW reduction programme for the urban core.",
    infraType: "Water & Utilities",
    region: "Central Urban Districts",
    status: "Planning",
    budgetCrore: 3450,
    targetCompletion: "2029",
    riskLevel: "Moderate",
    capacityTarget: "24×7 supply for 2.1M residents",
    sustainabilityPriorities: ["Non-revenue water reduction", "Energy-efficient pumping"],
    requirements:
      "Modernize the ring water grid to cut non-revenue water below 15% and enable continuous supply across nine districts.",
    stations: null,
    corridorKm: null,
    featured: false,
    archived: false,
    createdAt: daysAgo(150),
    updatedAt: daysAgo(11),
  },
  {
    id: "PRJ-1004",
    name: "Regional Solar & Grid Interconnect",
    description: "1.2 GW solar complex with 220 kV pooling stations and 140 km of double-circuit evacuation lines.",
    infraType: "Energy Grid",
    region: "Eastern Plateau",
    status: "Approved",
    budgetCrore: 6780,
    targetCompletion: "2031",
    riskLevel: "Low",
    capacityTarget: "1.2 GW generation, 2,600 GWh/year",
    sustainabilityPriorities: ["Utility-scale renewables", "Grid stability services"],
    requirements:
      "Plan generation siting, pooling infrastructure and evacuation corridors for a 1.2 GW solar complex with grid-support functions.",
    stations: null,
    corridorKm: 140,
    featured: false,
    archived: false,
    createdAt: daysAgo(320),
    updatedAt: daysAgo(19),
  },
  {
    id: "PRJ-1005",
    name: "Northgate International Airport Expansion",
    description: "Second terminal, midfield concourse and cargo village raising capacity to 34 MPPA with a dedicated metro link.",
    infraType: "Airports",
    region: "Northern Periphery",
    status: "Planning",
    budgetCrore: 12300,
    targetCompletion: "2033",
    riskLevel: "High",
    capacityTarget: "34 million passengers per annum",
    sustainabilityPriorities: ["Green terminal certification", "Sustainable aviation fuel readiness"],
    requirements:
      "Sequence terminal, airside and landside works to expand capacity to 34 MPPA while keeping the existing terminal fully operational.",
    stations: null,
    corridorKm: null,
    featured: false,
    archived: false,
    createdAt: daysAgo(180),
    updatedAt: daysAgo(8),
  },
  {
    id: "PRJ-1006",
    name: "Inland Container Port & Logistics Hub",
    description: "Riverine container terminal with rail-served freight village and 26 km of last-mile connector roads.",
    infraType: "Ports & Logistics",
    region: "Riverine Trade Zone",
    status: "On Hold",
    budgetCrore: 5150,
    targetCompletion: "2031",
    riskLevel: "Critical",
    capacityTarget: "1.1M TEU annual throughput",
    sustainabilityPriorities: ["Modal shift to waterways", "Shore-to-ship power"],
    requirements:
      "Assess viability of a riverine container terminal with rail freight interchange; resolve dredging and land acquisition blockers.",
    stations: null,
    corridorKm: 26,
    featured: false,
    archived: false,
    createdAt: daysAgo(400),
    updatedAt: daysAgo(33),
  },
  {
    id: "PRJ-1007",
    name: "Urban Fiber Backbone Phase 2",
    description: "1,900 km duct-and-fiber backbone extension covering industrial corridors and 480 public institutions.",
    infraType: "Digital Infrastructure",
    region: "Metropolitan Core",
    status: "In Delivery",
    budgetCrore: 980,
    targetCompletion: "2027",
    riskLevel: "Low",
    capacityTarget: "480 institutions connected, 100G backbone",
    sustainabilityPriorities: ["Shared ducting with utilities"],
    requirements:
      "Extend the metro fiber backbone along industrial corridors using shared utility ducts; connect 480 public institutions.",
    stations: null,
    corridorKm: null,
    featured: false,
    archived: false,
    createdAt: daysAgo(260),
    updatedAt: daysAgo(3),
  },
  {
    id: "PRJ-1008",
    name: "Riverfront Flood Resilience Program",
    description: "Embankment upgrades, floodable parks, and early-warning systems across 14 old riverfront wards.",
    infraType: "Flood & Coastal",
    region: "Old Riverfront Wards",
    status: "Scenario Evaluation",
    budgetCrore: 2300,
    targetCompletion: "2030",
    riskLevel: "High",
    capacityTarget: "1-in-50 year flood protection for 640,000 residents",
    sustainabilityPriorities: ["Nature-based retention", "Blue-green corridors"],
    requirements:
      "Design a phased flood resilience programme combining engineered embankments with nature-based retention for 14 riverfront wards.",
    stations: null,
    corridorKm: null,
    featured: false,
    archived: false,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(1),
  },
];

export const SEED_ACTIVITIES: ActivityItem[] = [
  { id: "ACT-1", actor: "A. Deshmukh", action: "re-ran the scenario simulation for", target: "Sustainability-Optimized Plan", time: daysAgo(0.12), kind: "simulation" },
  { id: "ACT-2", actor: "Planning Studio", action: "completed a structured analysis for", target: "Metro Intelligence", time: daysAgo(0.8), kind: "analysis" },
  { id: "ACT-3", actor: "R. Iyer", action: "flagged a high-priority utility conflict on", target: "Line B · Airport Link corridor", time: daysAgo(1.4), kind: "geo" },
  { id: "ACT-4", actor: "S. Banerjee", action: "updated risk register entries for", target: "Riverfront Flood Resilience Program", time: daysAgo(1.9), kind: "project" },
  { id: "ACT-5", actor: "M. Okafor", action: "exported the evidence pack for", target: "Metro Intelligence Planning Analysis", time: daysAgo(2.6), kind: "report" },
  { id: "ACT-6", actor: "A. Deshmukh", action: "moved to In Review:", target: "Western Coastal Highway Corridor", time: daysAgo(6), kind: "project" },
];

export const PROJECT_STATUSES: ProjectStatus[] = [
  "Scenario Evaluation",
  "Planning",
  "In Review",
  "Approved",
  "In Delivery",
  "On Hold",
  "Archived",
];

export const INFRA_TYPES = [
  "Rail & Transit",
  "Highways & Roads",
  "Water & Utilities",
  "Energy Grid",
  "Airports",
  "Ports & Logistics",
  "Digital Infrastructure",
  "Flood & Coastal",
] as const;

export const REGIONS = [
  "Northern Metro Region",
  "Western Coastal Belt",
  "Central Urban Districts",
  "Eastern Plateau",
  "Northern Periphery",
  "Riverine Trade Zone",
  "Metropolitan Core",
  "Old Riverfront Wards",
];

export const SUSTAINABILITY_OPTIONS = [
  "Low-carbon construction",
  "Renewable traction power",
  "Transit-oriented development",
  "Nature-based retention",
  "Energy-efficient pumping",
  "Recycled materials",
  "Modal shift",
  "Green building certification",
];

export const DEMO_BANNER =
  "Illustrative dataset — prototype values only, not verified project facts.";
