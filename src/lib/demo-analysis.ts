import type { AnalysisResult, Project, ScenarioInputs } from "@/lib/types";
import { runScenario, BASELINE_SCENARIO } from "@/lib/simulation";
import { formatCrore } from "@/lib/format";

/**
 * Deterministic demo-planning generator.
 *
 * Produces structured, internally consistent planning analysis without an AI
 * model. Numbers come from the same simulation engine as the Digital Twin so
 * the Studio, Twin and Reports pages never contradict each other.
 * This is clearly labeled "demo analysis" in the UI — it is NOT presented as
 * live AI output.
 */

export function buildScenarioInputs(project: Project): ScenarioInputs {
  if (project.stations || project.corridorKm) {
    return {
      ...BASELINE_SCENARIO,
      budgetCrore: project.budgetCrore,
      stations: project.stations ?? BASELINE_SCENARIO.stations,
      corridorKm: project.corridorKm ?? BASELINE_SCENARIO.corridorKm,
      sustainabilityPriorities: project.sustainabilityPriorities.length
        ? project.sustainabilityPriorities
        : BASELINE_SCENARIO.sustainabilityPriorities,
    };
  }
  const km = project.corridorKm ?? Math.max(12, Math.round(project.budgetCrore / 190));
  return {
    ...BASELINE_SCENARIO,
    budgetCrore: project.budgetCrore,
    stations: Math.max(6, Math.round(km * 0.55)),
    corridorKm: km,
    sustainabilityPriorities: project.sustainabilityPriorities,
  };
}

export function buildDemoAnalysis(
  project: Project,
  requirements: string,
  objectives: string[],
): AnalysisResult {
  const inputs = buildScenarioInputs(project);
  const out = runScenario(inputs);
  const { capex, schedule, demand, resources, risk, sustainability } = out;

  const executiveSummary = [
    `${project.name} is assessed as a ${inputs.corridorKm} km, ${inputs.stations}-station programme with ` +
      `a ${formatCrore(project.budgetCrore)} capital envelope and a ${inputs.constructionYears}-year delivery target.`,
    `Modeled direct cost is ${formatCrore(capex.totalModeled)} (${capex.budgetUtilizationPct.toFixed(1)}% of envelope), ` +
      `${capex.withinBudget ? "leaving" : "exceeding the envelope by"} ${formatCrore(Math.abs(project.budgetCrore - capex.totalModeled))} ${capex.withinBudget ? "of headroom" : ""}.`,
    `Practical daily capacity of ${demand.dailyCapacityOffered.toLocaleString("en-IN")} riders covers ${demand.demandCoveragePct.toFixed(0)}% of the assumed demand; ` +
      `composite risk scores ${risk.score}/100 (${risk.level}).`,
  ].join(" ");

  return {
    mode: "demo",
    projectId: project.id,
    projectName: project.name,
    generatedAt: new Date().toISOString(),
    executiveSummary,
    agents: [
      {
        agent: "Transportation Planning",
        summary:
          `A ${inputs.corridorKm} km alignment with ${inputs.stations} stations yields an average spacing of ` +
          `${(inputs.corridorKm / Math.max(1, inputs.stations - 1)).toFixed(1)} km — within the 0.8–1.6 km envelope appropriate for urban metro service.`,
        findings: [
          `Peak-hour loading index is ${demand.peakCrowdingIndex.toFixed(2)}× practical capacity${demand.peakCrowdingIndex > 1 ? "; platform sizing and headway planning must absorb the overflow" : ", leaving acceptable crowding margins"}.`,
          `Recommended service: ${MODEL_TRIPS_TEXT(inputs)}.`,
          `Interchange placement should prioritise the two highest-transfer nodes rather than maximising coverage overlap.`,
        ],
        metrics: [
          { label: "Avg. station spacing", value: `${(inputs.corridorKm / Math.max(1, inputs.stations - 1)).toFixed(2)} km` },
          { label: "Demand coverage", value: `${demand.demandCoveragePct.toFixed(0)}%` },
          { label: "Peak crowding", value: `${demand.peakCrowdingIndex.toFixed(2)}×` },
        ],
      },
      {
        agent: "Financial Analysis",
        summary: `Modeled capex of ${formatCrore(capex.totalModeled)} against a ${formatCrore(project.budgetCrore)} envelope.`,
        findings: [
          `Civil works dominate at ${formatCrore(capex.civil)} (${Math.round((capex.civil / capex.totalModeled) * 100)}% of modeled cost).`,
          `Contingency is held at 12% (${formatCrore(capex.contingency)}); land assembly contributes ${formatCrore(capex.land)} across ${inputs.stations} station sites.`,
          capex.withinBudget
            ? `Envelope headroom of ${formatCrore(project.budgetCrore - capex.totalModeled)} is adequate for design development but not for scope growth.`
            : `The modeled scope exceeds the envelope by ${formatCrore(capex.totalModeled - project.budgetCrore)} — descoping or phased funding is required before approval.`,
        ],
        metrics: [
          { label: "Cost per km", value: formatCrore(Math.round(capex.totalModeled / inputs.corridorKm)) },
          { label: "Cost per station", value: formatCrore(Math.round(capex.totalModeled / inputs.stations)) },
          { label: "Envelope utilization", value: `${capex.budgetUtilizationPct.toFixed(1)}%` },
        ],
      },
      {
        agent: "Environmental Assessment",
        summary: `Sustainability score ${sustainability.score}/100 with an estimated ${sustainability.co2AvoidedTonsPerYear.toLocaleString("en-IN")} t CO₂ avoided per year from modal shift.`,
        findings: [
          `Flood-plain and heritage conditions apply to portions of the alignment; elevated structures are recommended where the 1-in-50 flood extent is crossed.`,
          renewableNote(inputs),
          `A 3:1 compensatory planting policy applies to an estimated 1,900 affected trees.`,
        ],
        metrics: [
          { label: "CO₂ avoided / year", value: `${sustainability.co2AvoidedTonsPerYear.toLocaleString("en-IN")} t` },
          { label: "Renewable share", value: `${sustainability.renewableSharePct}%` },
          { label: "Sustainability score", value: `${sustainability.score}/100` },
        ],
      },
      {
        agent: "Utilities & Dependencies",
        summary: `${resources.annualEnergyGwh.toFixed(1)} GWh/year traction demand; three utility corridor conflicts require early diversion design.`,
        findings: [
          `Two 33 kV traction feeders and a dedicated substation per 8–10 km section are required before systems installation.`,
          `The 1,200 mm water trunk main crosses the alignment at three points; diversion must precede box excavation at the historic-core station.`,
          `Depot land handover is on the critical path for fleet acceptance and commissioning.`,
        ],
        metrics: [
          { label: "Fleet requirement", value: `${resources.fleetTrains} trains` },
          { label: "Annual traction energy", value: `${resources.annualEnergyGwh.toFixed(1)} GWh` },
          { label: "Staff estimate", value: `${resources.staffEstimate.toLocaleString("en-IN")} FTE` },
        ],
      },
      {
        agent: "Risk Analysis",
        summary: `Composite risk ${risk.score}/100 (${risk.level}). Primary drivers: ${risk.drivers[0].toLowerCase()}.`,
        findings: [
          ...risk.drivers.map((d) => d + "."),
          `Land acquisition across the identified parcels remains the dominant schedule exposure; statutory powers bound but do not eliminate delay.`,
        ],
        metrics: [
          { label: "Composite risk", value: `${risk.score}/100` },
          { label: "Risk level", value: risk.level },
          { label: "Schedule pressure", value: `${schedule.schedulePressurePct.toFixed(1)}%` },
        ],
      },
    ],
    recommendations: [
      {
        title: capex.withinBudget ? "Protect the contingency margin" : "Descope or phase funding before approval",
        rationale: capex.withinBudget
          ? `Modeled cost sits at ${capex.budgetUtilizationPct.toFixed(1)}% of the envelope. Early design development historically consumes remaining headroom; ring-fence the 12% contingency from scope growth.`
          : `Modeled cost exceeds the envelope by ${formatCrore(capex.totalModeled - project.budgetCrore)}. Approving without descoping converts a planning gap into a delivery crisis.`,
      },
      {
        title: "Sequence utility diversions ahead of station boxes",
        rationale:
          "The water trunk-main crossings and telecom duct banks sit under the two deepest station excavations. Diversion design released 6 months early removes the enabling-works criticality.",
      },
      {
        title: demand.peakCrowdingIndex > 1 ? "Increase peak capacity or flatten demand" : "Validate demand against updated land-use forecasts",
        rationale: demand.peakCrowdingIndex > 1
          ? `Peak loading of ${demand.peakCrowdingIndex.toFixed(2)}× practical capacity will degrade service quality from day one; consider 6-car platform provision or peak spreading measures.`
          : `Coverage at ${demand.demandCoveragePct.toFixed(0)}% of assumed demand is acceptable, but the assumption itself should be re-based on the latest land-use forecasts before design freeze.`,
      },
    ],
    costs: [
      { label: "Civil works", valueCrore: capex.civil, note: `₹150 cr/km × ${inputs.corridorKm} km` },
      { label: "Systems & signaling", valueCrore: capex.systems, note: `₹41 cr/km × ${inputs.corridorKm} km` },
      { label: "Land & urban integration", valueCrore: capex.land, note: `₹62 cr/station × ${inputs.stations}` },
      { label: "Rolling stock", valueCrore: Math.round(capex.rollingStock), note: `${resources.fleetTrains} trains` },
      { label: "Contingency (12%)", valueCrore: capex.contingency },
    ],
    deliveryConsiderations: [
      `Modeled duration ${schedule.estimatedYears} years against a ${inputs.constructionYears}-year target (${schedule.schedulePressurePct > 0 ? `${schedule.schedulePressurePct.toFixed(1)}% over target` : `${Math.abs(schedule.schedulePressurePct).toFixed(1)}% under target`}).`,
      "Two-package procurement (civil / systems) recommended to parallelize design development.",
      "Depot land handover gates fleet acceptance — secure the site before financial close on rolling stock.",
      "Heritage precinct vibration limits require low-impact plant selection in the historic core.",
    ],
    environmentalConstraints: [
      "1-in-50 year flood extent crosses the alignment — elevated structures with scour protection.",
      "Heritage precinct: vibration and visual-impact conditions at the historic-core station.",
      "≈1,900 trees affected; 3:1 compensatory planting policy applies.",
      renewableNote(inputs),
    ],
    dependencies: [
      { item: "Utility diversion design release", criticality: "High", note: "Blocks historic-core box excavation." },
      { item: "Depot land handover", criticality: "High", note: "Gates rolling-stock delivery and commissioning." },
      { item: "Traction power supply agreement", criticality: "Moderate", note: "Two 33 kV feeders required before systems install." },
      { item: "Airport express junction MOU", criticality: "Moderate", note: "Freezes junction design on the cross-city link." },
    ],
    risks: [
      { risk: "Land acquisition delay across identified parcels", severity: "High", mitigation: "Early statutory process with milestone-based escrow." },
      { risk: "Unknown buried services extend enabling works", severity: "High", mitigation: "GPR survey plus 15% diversion schedule float." },
      { risk: "Opening-year demand below forecast", severity: "Moderate", mitigation: "Peak-spreading fares and feeder-bus integration." },
      { risk: "Construction cost escalation above envelope", severity: capex.withinBudget ? "Moderate" : "High", mitigation: "Indexed contracts with dispute-avoidance clauses." },
    ],
    confidence: {
      score: 62,
      explanation:
        "Demo analysis uses deterministic heuristics and illustrative unit rates. Suitable for option comparison and workflow demonstration only — not for investment decisions.",
    },
    assumptions: [
      "Unit rates: civil ₹150 cr/km, systems ₹41 cr/km, land ₹62 cr/station, 12% contingency.",
      "Demand assumptions are illustrative and not derived from surveyed travel data.",
      "Environmental constraints are illustrative stand-ins for real constraint mapping.",
      `Requirements brief: “${requirements.slice(0, 180)}${requirements.length > 180 ? "…" : ""}”`,
      objectives.length ? `Stated objectives: ${objectives.join("; ")}.` : "No additional objectives supplied.",
    ],
    evidence: [
      { label: "Scenario engine v1 (deterministic heuristics, this application)", kind: "Internal analysis" },
      { label: "Illustrative unit-rate schedule (demo constants, documented in Model Assumptions)", kind: "Illustrative" },
      { label: "Candidate station suitability scoring (demo dataset)", kind: "Illustrative" },
    ],
  };
}

function MODEL_TRIPS_TEXT(inputs: ScenarioInputs): string {
  const headway = Math.max(2, Math.round(3600 / (inputs.trainCapacityPerHour / 750)));
  return `${Math.round(60 / headway)} trains/hour peak service (${headway}-minute headways), 18-hour operating window`;
}

function renewableNote(inputs: ScenarioInputs): string {
  const hasRenewable = inputs.sustainabilityPriorities.some((p) => p.toLowerCase().includes("renewable"));
  return hasRenewable
    ? "Renewable traction power commitment raises modeled renewable share to an estimated 60%; a PPA strategy should be defined before financial close."
    : "Renewable share is modeled at the grid-default 35%; committing to a renewable PPA would materially improve the sustainability score.";
}
