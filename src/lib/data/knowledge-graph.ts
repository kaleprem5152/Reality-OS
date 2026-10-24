import type { GraphEdge, GraphNode } from "@/lib/types";

/**
 * Typed knowledge-graph dataset for the Metro Intelligence project.
 * All entities and relationships are illustrative but internally consistent:
 * stations/corridors match metro-network.ts, budgets match the project record.
 */

const nodes: GraphNode[] = [
  {
    id: "G-PRJ", label: "Metro Intelligence", type: "Project", x: 600, y: 400,
    detail: "Programme-level node: two corridors, 42 proposed stations, ₹18,500 cr capital envelope, 2032 target.",
    meta: [
      { label: "Status", value: "Scenario Evaluation" },
      { label: "Budget", value: "₹18,500 cr" },
      { label: "Target", value: "2032" },
    ],
  },
  // Corridors
  { id: "G-CORA", label: "Line A · Ring Trunk", type: "Corridor", x: 380, y: 210, detail: "38.4 km northwest–southeast trunk. Mixed elevated and cut-and-cover construction.", meta: [{ label: "Length", value: "38.4 km" }, { label: "Status", value: "Proposed" }] },
  { id: "G-CORB", label: "Line B · Airport Link", type: "Corridor", x: 820, y: 210, detail: "29.6 km cross-city link with national rail interchange and airport-express junction provision.", meta: [{ label: "Length", value: "29.6 km" }, { label: "Status", value: "Under study" }] },
  // Stations
  { id: "G-ST05", label: "Old Market Interchange", type: "Station", x: 250, y: 330, detail: "Highest-density retail catchment; interchange between Line A and the CBD branch. Daily ridership ~71,800.", meta: [{ label: "Ridership/day", value: "71,800" }, { label: "Constraints", value: "Heritage, utilities" }] },
  { id: "G-ST11", label: "Central Rail Interchange", type: "Station", x: 950, y: 330, detail: "Primary interchange with national rail and long-distance bus terminals. Concourse sized by transfer flows.", meta: [{ label: "Ridership/day", value: "85,600" }] },
  { id: "G-ST04", label: "Civic Center", type: "Station", x: 300, y: 480, detail: "Government quarter station; strong accessibility scores, constrained construction staging.", meta: [{ label: "Ridership/day", value: "62,300" }] },
  { id: "G-ST12", label: "Airport Link Junction", type: "Station", x: 900, y: 480, detail: "Future junction with the PRJ-1005 airport express; passive provision included in first phase.", meta: [{ label: "Ridership/day", value: "18,300" }] },
  // Utilities
  { id: "G-UT1", label: "High-voltage feeders", type: "Utility", x: 1050, y: 130, detail: "Two 33 kV traction-power feeders and a dedicated substation per 8–10 km section.", meta: [{ label: "Critical window", value: "Phase 1 enabling works" }] },
  { id: "G-UT2", label: "Water trunk main", type: "Utility", x: 1120, y: 260, detail: "1,200 mm trunk main crossing the Old Market alignment; diversion design route-approved.", meta: [{ label: "Conflict points", value: "3 crossings" }] },
  { id: "G-UT3", label: "Telecom duct banks", type: "Utility", x: 1080, y: 390, detail: "City fiber backbone runs parallel to 14 km of corridor; shared-duct agreement with PRJ-1007.", meta: [{ label: "Shared corridor", value: "14 km" }] },
  // Budgets
  { id: "G-B1", label: "Phase 1 Capital Envelope", type: "Budget", x: 600, y: 640, detail: "₹9,800 cr — Line A trunk plus Central Rail Interchange. Includes 12% contingency.", meta: [{ label: "Amount", value: "₹9,800 cr" }] },
  { id: "G-B2", label: "Phase 2 Capital Envelope", type: "Budget", x: 380, y: 660, detail: "₹8,700 cr — Line B and depot expansion, contingent on Phase 1 ridership verification.", meta: [{ label: "Amount", value: "₹8,700 cr" }] },
  // Environmental constraints
  { id: "G-E1", label: "River flood-plain", type: "Environmental Constraint", x: 1080, y: 540, detail: "Line A Riverbank section crosses a 1-in-50 year flood extent; elevated station box and scour protection required.", meta: [{ label: "Affected", value: "2.1 km of Line A" }] },
  { id: "G-E2", label: "Heritage precinct", type: "Environmental Constraint", x: 1080, y: 660, detail: "Old Market precinct: vibration limits and visual-impact conditions apply to cut-and-cover works.", meta: [{ label: "Affected", value: "Old Market station" }] },
  { id: "G-E3", label: "Urban tree canopy", type: "Environmental Constraint", x: 950, y: 720, detail: "Approx. 1,900 trees along both alignments; compensatory planting policy 3:1 applies.", meta: [{ label: "Policy", value: "3:1 compensatory planting" }] },
  // Regulations
  { id: "G-R1", label: "Metro Rail Act · State rules", type: "Regulation", x: 160, y: 130, detail: "Enabling legislation for land acquisition, safety certification and fare notification.", meta: [{ label: "Stage", value: "Safety case drafting" }] },
  { id: "G-R2", label: "EIA Notification 2006", type: "Regulation", x: 300, y: 70, detail: "Environmental clearance path for linear projects; public consultation complete for Line A.", meta: [{ label: "Stage", value: "Line A clearance complete" }] },
  { id: "G-R3", label: "Land acquisition framework", type: "Regulation", x: 90, y: 260, detail: "Fair-value acquisition and rehabilitation policy; 62 parcels identified across both corridors.", meta: [{ label: "Parcels", value: "62 identified" }] },
  // Dependencies
  { id: "G-D1", label: "DB-1: Utility diversion", type: "Dependency", x: 60, y: 470, detail: "Water and telecom diversions must complete before Old Market box excavation.", meta: [{ label: "Blocking", value: "Old Market excavation" }] },
  { id: "G-D2", label: "DB-2: Depot land handover", type: "Dependency", x: 120, y: 590, detail: "East Terminal depot site handover gates rolling-stock delivery and commissioning.", meta: [{ label: "Blocking", value: "Fleet acceptance" }] },
  { id: "G-D3", label: "DB-3: Airport link MOU", type: "Dependency", x: 210, y: 700, detail: "Junction design freeze depends on the PRJ-1005 airport express memorandum of understanding.", meta: [{ label: "Blocking", value: "Junction design freeze" }] },
  // Risks
  { id: "G-X1", label: "RK-1: Land acquisition delay", type: "Risk", x: 500, y: 120, detail: "62-parcel acquisition programme on the critical path to Line A section 2.", meta: [{ label: "Severity", value: "High" }] },
  { id: "G-X2", label: "RK-2: Utility conflict overrun", type: "Risk", x: 660, y: 90, detail: "Unknown buried services in the historic core could extend enabling works by 2–3 quarters.", meta: [{ label: "Severity", value: "High" }] },
  { id: "G-X3", label: "RK-3: Ridership shortfall", type: "Risk", x: 800, y: 110, detail: "Opening-year demand below 75% of forecast would delay Phase 2 trigger.", meta: [{ label: "Severity", value: "Moderate" }] },
];

const edges: GraphEdge[] = [
  { source: "G-PRJ", target: "G-CORA", relation: "contains", explanation: "Line A is one of two delivery corridors in the programme." },
  { source: "G-PRJ", target: "G-CORB", relation: "contains", explanation: "Line B is the second delivery corridor (under study)." },
  { source: "G-CORA", target: "G-ST05", relation: "serves", explanation: "Old Market is the principal Line A interchange." },
  { source: "G-CORA", target: "G-ST04", relation: "serves", explanation: "Civic Center is served by Line A." },
  { source: "G-CORB", target: "G-ST11", relation: "serves", explanation: "Line B interchanges with national rail here." },
  { source: "G-CORB", target: "G-ST12", relation: "serves", explanation: "Airport Link Junction is on Line B." },
  { source: "G-CORA", target: "G-UT2", relation: "crosses", explanation: "Alignment crosses the 1,200 mm water trunk main at three points." },
  { source: "G-PRJ", target: "G-UT1", relation: "powered by", explanation: "Traction power supply agreement under negotitation." },
  { source: "G-PRJ", target: "G-UT3", relation: "shares corridor", explanation: "Shared-duct agreement with the fiber backbone programme (PRJ-1007)." },
  { source: "G-PRJ", target: "G-B1", relation: "funded by", explanation: "Phase 1 envelope funds Line A and the interchange." },
  { source: "G-PRJ", target: "G-B2", relation: "funded by", explanation: "Phase 2 envelope funds Line B and depot expansion." },
  { source: "G-ST05", target: "G-B1", relation: "draws on", explanation: "Old Market works are budgeted within Phase 1." },
  { source: "G-CORA", target: "G-E1", relation: "constrained by", explanation: "Flood-plain crossing drives the elevated section design." },
  { source: "G-ST05", target: "G-E2", relation: "constrained by", explanation: "Heritage vibration and visual conditions apply to the station box." },
  { source: "G-PRJ", target: "G-E3", relation: "constrained by", explanation: "Tree canopy policy applies across both corridors." },
  { source: "G-PRJ", target: "G-R1", relation: "governed by", explanation: "Safety certification under the Metro Rail Act." },
  { source: "G-CORA", target: "G-R2", relation: "governed by", explanation: "Environmental clearance for Line A obtained under the EIA process." },
  { source: "G-B1", target: "G-R3", relation: "governed by", explanation: "Acquisition funded and executed under the land framework." },
  { source: "G-ST05", target: "G-D1", relation: "depends on", explanation: "Station box excavation starts after diversions complete." },
  { source: "G-B1", target: "G-D2", relation: "depends on", explanation: "Fleet acceptance depends on depot land handover." },
  { source: "G-ST12", target: "G-D3", relation: "depends on", explanation: "Junction design freeze needs the airport express MOU." },
  { source: "G-D1", target: "G-X2", relation: "exposed to", explanation: "Unknown services in the historic core threaten the diversion programme." },
  { source: "G-R3", target: "G-X1", relation: "exposed to", explanation: "62-parcel programme is on the Line A critical path." },
  { source: "G-B2", target: "G-X3", relation: "exposed to", explanation: "Phase 2 trigger depends on verified opening-year demand." },
  { source: "G-R1", target: "G-X1", relation: "mitigates", explanation: "Statutory acquisition powers bound the delay exposure." },
  { source: "G-UT1", target: "G-X2", relation: "mitigates", explanation: "Early feeder survey work de-risks enabling works sequencing." },
];

export const GRAPH_NODES = nodes;
export const GRAPH_EDGES = edges;

export const GRAPH_NODE_COLORS: Record<string, string> = {
  Project: "#F2F3F5",
  Corridor: "#8A93A3",
  Station: "#9AA1AC",
  Utility: "#7E8A99",
  Budget: "#3FA97F",
  "Environmental Constraint": "#D2A24C",
  Regulation: "#5C6771",
  Dependency: "#94826A",
  Risk: "#D76060",
  Report: "#5C99E2",
};

/**
 * Builds dynamic knowledge graph nodes and edges strictly from the current workspace's
 * real persisted projects and reports.
 * If projects or reports do not exist, returns empty arrays.
 * Dependencies and milestones are not fabricated and are marked as unavailable.
 */
export function buildWorkspaceGraph(
  projects: import("@/lib/types").Project[],
  reports: import("@/lib/types").Report[],
  _currency: "INR" | "USD" = "INR",
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (!projects || projects.length === 0) {
    return { nodes: [], edges: [] };
  }

  const gNodes: GraphNode[] = [];
  const gEdges: GraphEdge[] = [];

  const cx = 600;
  const cy = 380;
  const numProj = projects.length;

  projects.forEach((proj, idx) => {
    let px = cx;
    let py = cy;
    if (numProj > 1) {
      const angle = (2 * Math.PI * idx) / numProj - Math.PI / 2;
      const rx = numProj === 2 ? 260 : 320;
      const ry = numProj === 2 ? 0 : 200;
      px = Math.round(cx + rx * Math.cos(angle));
      py = Math.round(cy + ry * Math.sin(angle));
    }

    gNodes.push({
      id: proj.id,
      label: proj.name,
      type: "Project",
      x: px,
      y: py,
      detail: proj.description || `${proj.infraType} project in ${proj.region}. Capital envelope: ₹${proj.budgetCrore} cr.`,
      meta: [
        { label: "Status", value: proj.status },
        { label: "Infra Type", value: proj.infraType },
        { label: "Region", value: proj.region },
        { label: "Budget", value: `₹${proj.budgetCrore} cr` },
        { label: "Target Completion", value: proj.targetCompletion },
        { label: "Risk Level", value: proj.riskLevel },
        { label: "Corridor Length", value: proj.corridorKm ? `${proj.corridorKm} km` : "Unavailable" },
        { label: "Station Count", value: proj.stations ? String(proj.stations) : "Unavailable" },
        { label: "Dependencies & Milestones", value: "Unavailable — No dependency registry configured" },
      ],
    });

    // If corridor or station count exist, add corridor node
    if (proj.corridorKm && proj.corridorKm > 0) {
      const corId = `${proj.id}-COR`;
      const corAngle = (2 * Math.PI * idx) / numProj - Math.PI / 2 + 0.3;
      const corDist = 130;
      gNodes.push({
        id: corId,
        label: `${proj.name} Corridor`,
        type: "Corridor",
        x: Math.round(px + corDist * Math.cos(corAngle)),
        y: Math.round(py + corDist * Math.sin(corAngle)),
        detail: `${proj.corridorKm} km corridor alignment for ${proj.name}. Station count: ${proj.stations ?? "N/A"}.`,
        meta: [
          { label: "Length", value: `${proj.corridorKm} km` },
          { label: "Stations", value: proj.stations ? String(proj.stations) : "Unavailable" },
          { label: "Status", value: proj.status },
        ],
      });
      gEdges.push({
        source: proj.id,
        target: corId,
        relation: "alignment",
        explanation: `${proj.name} specifies a ${proj.corridorKm} km corridor alignment.`,
      });
    }

    // Connect reports for this project
    const projReports = reports.filter((r) => r.projectId === proj.id);
    projReports.forEach((rpt, rIdx) => {
      const rAngle = ((2 * Math.PI * (rIdx + 1)) / (projReports.length + 1)) - Math.PI / 2;
      const rDist = 140;
      const rx = Math.round(px + rDist * Math.cos(rAngle));
      const ry = Math.round(py + rDist * Math.sin(rAngle));

      gNodes.push({
        id: rpt.id,
        label: rpt.title,
        type: "Report",
        x: rx,
        y: ry,
        detail: `Report for ${proj.name}. Type: ${rpt.reportType}. Status: ${rpt.status}.`,
        meta: [
          { label: "Report Type", value: rpt.reportType },
          { label: "Status", value: rpt.status },
          { label: "Project", value: proj.name },
          { label: "Created", value: new Date(rpt.createdAt).toLocaleDateString() },
        ],
      });

      gEdges.push({
        source: proj.id,
        target: rpt.id,
        relation: "evaluated by",
        explanation: `Report "${rpt.title}" evaluates project ${proj.name}.`,
      });
    });
  });

  return { nodes: gNodes, edges: gEdges };
}
