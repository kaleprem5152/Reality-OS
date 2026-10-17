import type { Corridor, Station } from "@/lib/types";

/**
 * Illustrative metro network for the featured Metro Intelligence project.
 *
 * `x/y` are OCTOLINEAR schematic coordinates: every corridor segment runs at
 * 0°, 45° or 90° on a 10px grid, following standard transit-diagram
 * (Beck-style) conventions. They are topological, not geographic.
 *
 * `lat/lng` are illustrative candidate locations derived from the same
 * topology via a linear transform, so the Geo map and the Command Center
 * schematic describe a consistent network footprint (~17 km across).
 *
 * The full programme holds 42 stations; this set models the 16 key stations
 * (terminals, interchanges, major stops) plus candidates used for comparison.
 */

const mk = (
  id: string,
  code: string,
  name: string,
  line: Station["line"],
  x: number,
  y: number,
  labelPos: Station["labelPos"],
  lat: number,
  lng: number,
  type: Station["type"],
  catchment: string,
  dailyRidership: number,
  suitability?: Station["suitability"],
): Station => ({ id, code, name, line, x, y, labelPos, lat, lng, type, catchment, dailyRidership, suitability });

export const STATIONS: Station[] = [
  /* ---------------------------- Line A (west → east) --------------------------- */
  mk("ST-01", "NWG", "Northgate West", "Line A", 110, 140, "top", 21.1722, 79.0021, "Terminal", "Residential expansion zone, airport feeder", 41200, {
    overall: 86, accessibility: 88, populationCoverage: 82, transitProximity: 71, environmental: 92, landUse: 94,
    note: "Open development land, minimal ecological constraints, strong feeder demand.",
  }),
  mk("ST-02", "UNV", "University District", "Line A", 230, 140, "top", 21.1722, 79.0249, "Standard", "Two universities, 38k students", 38700, {
    overall: 81, accessibility: 84, populationCoverage: 86, transitProximity: 63, environmental: 88, landUse: 81,
    note: "Dense student catchment; moderate distance to existing bus hub.",
  }),
  mk("ST-03", "INP", "Industrial Park Gate", "Line A", 350, 140, "top", 21.1722, 79.0477, "Standard", "Manufacturing employment cluster", 29400, {
    overall: 72, accessibility: 76, populationCoverage: 66, transitProximity: 58, environmental: 84, landUse: 78,
    note: "Shift-based demand; last-mile connectivity to factory gates needed.",
  }),
  mk("ST-16", "CBD", "Core Business Cand. C", "Line A", 470, 140, "top", 21.1722, 79.0705, "Standard", "Office towers, convention centre", 44200, {
    overall: 89, accessibility: 92, populationCoverage: 91, transitProximity: 84, environmental: 74, landUse: 62,
    note: "Candidate station — highest overall score; land assembly is the principal constraint.",
  }),
  mk("ST-04", "CIV", "Civic Center", "Line A", 590, 140, "top", 21.1722, 79.0933, "Interchange", "Government quarter, courts, secretariat", 62300, {
    overall: 83, accessibility: 90, populationCoverage: 88, transitProximity: 79, environmental: 68, landUse: 70,
    note: "Highest accessibility score; construction staging constrained by heritage buildings.",
  }),
  mk("ST-05", "MKT", "Old Market", "Line A", 710, 260, "top", 21.1518, 79.1161, "Interchange", "Historic retail core, pedestrian district", 71800, {
    overall: 77, accessibility: 86, populationCoverage: 93, transitProximity: 82, environmental: 54, landUse: 55,
    note: "Densest catchment on the network; requires careful utilities diversion and heritage approvals.",
  }),
  mk("ST-06", "RIV", "Riverbank", "Line A", 830, 260, "top", 21.1518, 79.1389, "Standard", "Riverfront redevelopment precinct", 33500, {
    overall: 64, accessibility: 71, populationCoverage: 69, transitProximity: 66, environmental: 41, landUse: 72,
    note: "Flood-plain adjacency lowers the environmental score; elevated station box proposed.",
  }),
  mk("ST-07", "TEC", "Technology Corridor", "Line A", 930, 360, "left", 21.1348, 79.1579, "Standard", "IT campus cluster, 60k jobs", 52800, {
    overall: 79, accessibility: 77, populationCoverage: 74, transitProximity: 61, environmental: 90, landUse: 93,
    note: "Greenfield station site with employer-funded access plaza under discussion.",
  }),
  mk("ST-08", "EST", "East Terminal", "Line A", 930, 460, "left", 21.1178, 79.1579, "Terminal", "Eastern growth corridor, depot site", 30100, {
    overall: 74, accessibility: 70, populationCoverage: 72, transitProximity: 55, environmental: 87, landUse: 91,
    note: "Co-located maintenance depot reduces deadhead running; low existing transit provision.",
  }),

  /* -------------------------- Line B (southwest → northeast) ------------------------- */
  mk("ST-09", "SST", "South Stadium", "Line B", 130, 460, "bottom", 21.1178, 79.0059, "Terminal", "Sports district, event demand", 28700, {
    overall: 68, accessibility: 72, populationCoverage: 63, transitProximity: 59, environmental: 83, landUse: 80,
    note: "Event-driven peaks; interchange with BRT depot within 400 m.",
  }),
  mk("ST-10", "MED", "Medical Enclave", "Line B", 250, 460, "bottom", 21.1178, 79.0287, "Standard", "Three hospitals, medical college", 36900, {
    overall: 84, accessibility: 89, populationCoverage: 78, transitProximity: 70, environmental: 86, landUse: 85,
    note: "High all-day demand plate; strong equity case from hospital access analysis.",
  }),
  mk("ST-14", "GRP", "Green Park Cand. A", "Line B", 370, 460, "bottom", 21.1178, 79.0515, "Standard", "Park-edge mixed-use plots", 21400, {
    overall: 75, accessibility: 78, populationCoverage: 71, transitProximity: 64, environmental: 82, landUse: 79,
    note: "Candidate station — balanced scores, strong land-use flexibility.",
  }),
  mk("ST-11", "STN", "Central Rail Interchange", "Line B", 490, 340, "bottom", 21.1382, 79.0743, "Interchange", "Mainline rail station, long-distance bus terminal", 85600, {
    overall: 88, accessibility: 94, populationCoverage: 90, transitProximity: 97, environmental: 62, landUse: 58,
    note: "Primary national-rail interchange; passenger transfer modelling drives concourse sizing.",
  }),
  mk("ST-15", "HLR", "Hillridge Cand. B", "Line B", 690, 340, "bottom", 21.1382, 79.1123, "Standard", "Hill-edge residential", 17900, {
    overall: 61, accessibility: 58, populationCoverage: 60, transitProximity: 57, environmental: 66, landUse: 74,
    note: "Candidate station — gradient engineering increases cost; moderate catchment.",
  }),
  mk("ST-12", "APT", "Airport Link Junction", "Line B", 810, 220, "top", 21.1586, 79.1351, "Standard", "Proposed airport express branch", 18300, {
    overall: 70, accessibility: 65, populationCoverage: 48, transitProximity: 74, environmental: 79, landUse: 88,
    note: "Future-proofed junction for the PRJ-1005 airport link; staged opening planned.",
  }),
  mk("ST-13", "NPT", "North Port Logistics", "Line B", 930, 220, "top", 21.1586, 79.1579, "Terminal", "Freight village, logistics employment", 15600, {
    overall: 58, accessibility: 55, populationCoverage: 44, transitProximity: 51, environmental: 76, landUse: 84,
    note: "Lower ridership but strategic freight-worker access; single-track stabling provision.",
  }),
];

export const CORRIDORS: Corridor[] = [
  {
    id: "COR-A",
    name: "Line A · Ring Trunk",
    line: "Line A",
    points: ["ST-01", "ST-02", "ST-03", "ST-16", "ST-04", "ST-05", "ST-06", "ST-07", "ST-08"],
    lengthKm: 38.4,
    status: "Proposed",
    description:
      "Northwest–southeast trunk serving university, civic, market and technology districts. Mixed elevated and cut-and-cover alignment.",
  },
  {
    id: "COR-B",
    name: "Line B · Airport Link",
    line: "Line B",
    points: ["ST-09", "ST-10", "ST-14", "ST-11", "ST-15", "ST-12", "ST-13"],
    lengthKm: 29.6,
    status: "Under study",
    description:
      "Southwest–northeast cross-city link interchanging with national rail and providing the future airport express junction.",
  },
];

/**
 * Point where the two alignments cross without a shared station.
 * Line A segment ST-05→ST-06 (y=260) crosses Line B segment ST-15→ST-12.
 */
export const CROSSINGS = [{ x: 770, y: 260, note: "Grade-separated crossing — Line B passes beneath Line A. No transfer." }];

export const NETWORK_STATS = {
  totalStationsProgram: 42,
  modeledKeyStations: 16,
  corridorKm: 68,
  lines: 2,
  interchanges: 3,
  note: "Schematic shows the 16 key stations of the 42-station programme. Octolinear topology — distances are not to scale.",
};

/** Line colors: white trunk + mint branch read cleanly on the dark canvas. */
export const LINE_COLORS = {
  "Line A": "#F2F3F5",
  "Line B": "#7CD4AE",
} as const;
