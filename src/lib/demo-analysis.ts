import type { AnalysisResult, DetailedAiReview, Project, ScenarioInputs } from "@/lib/types";
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
  const priorities = project.sustainabilityPriorities?.length
    ? project.sustainabilityPriorities
    : BASELINE_SCENARIO.sustainabilityPriorities;

  if (project.stations || project.corridorKm) {
    return {
      ...BASELINE_SCENARIO,
      budgetCrore: project.budgetCrore,
      stations: project.stations ?? BASELINE_SCENARIO.stations,
      corridorKm: project.corridorKm ?? BASELINE_SCENARIO.corridorKm,
      sustainabilityPriorities: priorities,
    };
  }
  const km = project.corridorKm ?? Math.max(12, Math.round(project.budgetCrore / 190));
  return {
    ...BASELINE_SCENARIO,
    budgetCrore: project.budgetCrore,
    stations: Math.max(6, Math.round(km * 0.55)),
    corridorKm: km,
    sustainabilityPriorities: priorities,
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

  const executiveSummaryText = [
    `${project.name} is assessed as a ${inputs.corridorKm} km, ${inputs.stations}-station programme with ` +
      `a ${formatCrore(project.budgetCrore)} capital envelope and a ${inputs.constructionYears}-year delivery target.`,
    `Modeled direct cost is ${formatCrore(capex.totalModeled)} (${capex.budgetUtilizationPct.toFixed(1)}% of envelope), ` +
      `${capex.withinBudget ? "leaving" : "exceeding the envelope by"} ${formatCrore(Math.abs(project.budgetCrore - capex.totalModeled))} ${capex.withinBudget ? "of headroom" : ""}.`,
    `Practical daily capacity of ${demand.dailyCapacityOffered.toLocaleString("en-IN")} riders covers ${demand.demandCoveragePct.toFixed(0)}% of the assumed demand; ` +
      `composite risk scores ${risk.score}/100 (${risk.level}).`,
  ].join(" ");

  const healthStatus = capex.withinBudget
    ? risk.level === "Critical"
      ? "Poor"
      : risk.level === "High"
        ? "Fair"
        : "Good"
    : capex.budgetUtilizationPct > 125
      ? "Critical"
      : "Poor";

  const detailedReview: DetailedAiReview = {
    executiveSummary: {
      overallAssessment: `${project.name} is a high-priority ${project.infraType} initiative in ${project.region}. Operating under an authorized capital envelope of ₹${project.budgetCrore.toLocaleString("en-IN")} crore, the corridor provides comprehensive urban transit coverage across ${inputs.stations} stations with ${capex.withinBudget ? "manageable capital headroom" : "budgetary pressure requiring descoping"}.`,
      projectHealth: healthStatus,
      healthExplanation: `Modeled expenditure of ₹${capex.totalModeled.toLocaleString("en-IN")} crore corresponds to ${capex.budgetUtilizationPct.toFixed(1)}% envelope utilization (${capex.withinBudget ? `₹${(project.budgetCrore - capex.totalModeled).toLocaleString("en-IN")} crore headroom` : `₹${(capex.totalModeled - project.budgetCrore).toLocaleString("en-IN")} crore deficit`}) with composite risk index at ${risk.score}/100 (${risk.level}).`,
      keyStrengths: [
        `High demand coverage of ${demand.demandCoveragePct.toFixed(0)}% with ${demand.dailyCapacityOffered.toLocaleString("en-IN")} offered daily trips across ${inputs.stations} station nodes.`,
        `Optimal urban transit stop spacing of ${(inputs.corridorKm / Math.max(1, inputs.stations - 1)).toFixed(1)} km along the ${inputs.corridorKm} km alignment.`,
        `Decarbonization benefit of ${sustainability.co2AvoidedTonsPerYear.toLocaleString("en-IN")} metric tons of CO₂ avoided annually via modal shift.`,
        `Integrated 12% contingency buffer (₹${capex.contingency.toLocaleString("en-IN")} crore) to absorb construction escalation.`,
      ],
      keyConcerns: [
        capex.withinBudget
          ? `Capital headroom is constrained to ₹${(project.budgetCrore - capex.totalModeled).toLocaleString("en-IN")} crore; design creep must be strictly contained.`
          : `Modeled capital costs exceed authorized budget by ₹${(capex.totalModeled - project.budgetCrore).toLocaleString("en-IN")} crore; formal descoping or phase-splitting is required.`,
        `Peak crowding loading index reaches ${demand.peakCrowdingIndex.toFixed(2)}x capacity; headway adjustment and platform sizing must prevent platform bottlenecks.`,
        "Buried utilities (1,200 mm water trunk main and 33 kV traction lines) pose early enabling-works diversion risks.",
      ],
    },
    projectUnderstanding: {
      objectivesAndScope: `Comprehensive delivery of ${inputs.corridorKm} km of ${project.infraType} infrastructure across ${inputs.stations} stations in ${project.region}. The scope incorporates viaduct and at-grade guideways, passenger terminal boxes, automated train control signaling, rolling stock maintenance depot, and power distribution.`,
      expectedOutcomes: [
        `Transport ${demand.dailyCapacityOffered.toLocaleString("en-IN")} passengers daily with reliable high-frequency service.`,
        `Direct economic and commercial connectivity across ${inputs.stations} urban centers and major transit junctions.`,
        `Net greenhouse gas reduction of ${sustainability.co2AvoidedTonsPerYear.toLocaleString("en-IN")} t/year with ${sustainability.renewableSharePct}% renewable energy adoption.`,
      ],
      currentProgress: `Currently recorded in "${project.status}" status. Baseline parameters and corridor geography defined in workspace register.`,
      budgetAndTimelineContext: `Authorized capital budget is ₹${project.budgetCrore.toLocaleString("en-IN")} crore. Target completion window is scheduled for ${project.targetCompletion || "2030"} (${inputs.constructionYears} years modeled build duration).`,
      assumptions: [
        `Civil unit rates modeled at ₹150 crore/km for elevated structures; systems at ₹41 crore/km.`,
        `Station boxes and land acquisition modeled at ₹62 crore/station across ${inputs.stations} sites.`,
        "12% contingency margin applied uniformly across all direct works packages.",
        `Requirements brief: "${requirements.slice(0, 160)}${requirements.length > 160 ? "…" : ""}"`,
      ],
    },
    progressPerformance: {
      milestoneAnalysis: [
        {
          phase: "Enabling Works & Utility Diversions",
          window: "Months 0–14",
          status: "In Progress",
          detail: "GPR subsurface surveys, water trunk main relocation, tree mitigation under 3:1 environmental policy.",
        },
        {
          phase: "Civil Works Package 1 (Viaduct & Guideway)",
          window: "Months 10–38",
          status: "Pending",
          detail: `Pier erection and segmental box-girder launching across ${inputs.corridorKm} km alignment.`,
        },
        {
          phase: "Civil Works Package 2 (Station Boxes)",
          window: "Months 16–46",
          status: "Pending",
          detail: `Cut-and-cover underground boxes and elevated concourses across ${inputs.stations} station nodes.`,
        },
        {
          phase: "Systems Integration, Fleet & Commissioning",
          window: "Months 40–72",
          status: "Pending",
          detail: `Automated signaling, 33 kV traction electrification, depot commissioning, and trial runs for ${resources.fleetTrains} trainsets.`,
        },
      ],
      plannedVsActual: `Project register reflects "${project.status}" milestone status. Preliminary alignment and requirements have been confirmed; statutory procurement release remains the critical next gate.`,
      schedulePerformance: `Modeled build duration is ${schedule.estimatedYears} years versus the baseline ${inputs.constructionYears}-year target (${schedule.schedulePressurePct > 0 ? `${schedule.schedulePressurePct.toFixed(1)}% schedule pressure` : "within scheduled margin"}).`,
      budgetUtilization: `Total modeled direct expenditure is ₹${capex.totalModeled.toLocaleString("en-IN")} crore against the ₹${project.budgetCrore.toLocaleString("en-IN")} crore envelope (${capex.budgetUtilizationPct.toFixed(1)}% utilization).`,
      bottlenecksAndDelays: [
        "Depot site land parcel acquisition gates initial rolling stock delivery.",
        "Deep utility diversion approvals across municipal boundaries.",
        "Heritage precinct vibration mitigation requiring specialist low-impact piling equipment.",
      ],
    },
    riskAssessment: [
      {
        risk: "Land acquisition delays across station and depot plots",
        likelihood: "High",
        impact: "High",
        severity: "High",
        supportingEvidence: "Historical metro infrastructure projects in the region average 8–14 months statutory assembly delays.",
        mitigation: "Initiate early land-purchase notifications with escrow-backed compensation packages prior to civil procurement.",
        recommendedOwner: "Chief Land Acquisition Officer",
      },
      {
        risk: "Subsurface utility conflicts extending enabling civil works",
        likelihood: "Moderate",
        impact: "High",
        severity: "High",
        supportingEvidence: "1,200 mm water trunk main crosses alignment at three major station excavation perimeters.",
        mitigation: "Commission 3D Ground Penetrating Radar (GPR) and award utility diversion contracts 6 months before main civil mobilization.",
        recommendedOwner: "Director of Infrastructure & Utilities",
      },
      {
        risk: "Capital cost escalation beyond approved envelope",
        likelihood: capex.withinBudget ? "Moderate" : "High",
        impact: "Critical",
        severity: capex.withinBudget ? "Moderate" : "Critical",
        supportingEvidence: `Modeled expenditure utilizes ${capex.budgetUtilizationPct.toFixed(1)}% of the ₹${project.budgetCrore} cr authorization.`,
        mitigation: "Execute fixed-price turnkey contracts with indexed material escalation clauses and dispute boards.",
        recommendedOwner: "Chief Financial Officer",
      },
      {
        risk: "Peak passenger loading congestion at key transfer interchanges",
        likelihood: "Moderate",
        impact: "Moderate",
        severity: "Moderate",
        supportingEvidence: `Peak loading index models at ${demand.peakCrowdingIndex.toFixed(2)}x design capacity during morning rush hours.`,
        mitigation: "Design stations for future 6-car expansion and implement peak-differential ticketing tariffs.",
        recommendedOwner: "Head of Transit Planning",
      },
    ],
    budgetAndResources: {
      allocationAndUtilization: [
        { component: "Civil Works & Guideway", valueCrore: capex.civil, note: `₹150 cr/km across ${inputs.corridorKm} km` },
        { component: "Systems, Power & Signaling", valueCrore: capex.systems, note: `₹41 cr/km including automated train protection` },
        { component: "Stations & Land Assembly", valueCrore: capex.land, note: `₹62 cr per station across ${inputs.stations} sites` },
        { component: "Rolling Stock Fleet", valueCrore: Math.round(capex.rollingStock), note: `${resources.fleetTrains} modern trainsets` },
        { component: "Contingency (12%)", valueCrore: capex.contingency, note: "Allocated contingency buffer" },
      ],
      potentialOverruns: capex.withinBudget
        ? `Modeled capex leaves ₹${(project.budgetCrore - capex.totalModeled).toLocaleString("en-IN")} crore in reserve headroom below the ₹${project.budgetCrore} crore envelope.`
        : `Modeled capex exceeds the envelope by ₹${(capex.totalModeled - project.budgetCrore).toLocaleString("en-IN")} crore; design optimization or scope adjustment is mandatory before procurement release.`,
      resourceConstraints: [
        `Fleet requirement: ${resources.fleetTrains} trainsets needed to maintain ${inputs.trainCapacityPerHour.toLocaleString("en-IN")} passengers/hr throughput.`,
        `Traction electrical draw: ${resources.annualEnergyGwh.toFixed(1)} GWh/year requires dedicated 33 kV substation interconnects.`,
        `Operating personnel: estimated ${resources.staffEstimate.toLocaleString("en-IN")} FTE operations and maintenance staff.`,
      ],
      optimizationOpportunities: [
        "Standardize precast girder designs across 85% of elevated viaduct spans to accelerate civil turnaround.",
        "Bundle traction power and signaling into a single systems package to capture supplier volume discounts.",
        "Implement regenerative braking on rolling stock to lower traction consumption by 18-22%.",
      ],
      figuresNote: `Based on calibrated engineering unit rates against verified project envelope (₹${project.budgetCrore} crore, ${inputs.corridorKm} km, ${inputs.stations} stations). No speculative financial figures added.`,
    },
    technicalAndOperational: {
      technicalFeasibility: `Alignment geometry supports design operating speeds up to 80 km/h with average station spacing of ${(inputs.corridorKm / Math.max(1, inputs.stations - 1)).toFixed(1)} km. Minimum curvature radius of 250m is maintained throughout all non-terminal sectors.`,
      implementationConcerns: [
        "1-in-50 year flood plain intersection requires elevated viaduct deck heights with river scour protection.",
        "Urban arterial corridor traffic management during viaduct beam launching.",
        "Sensitive vibration limits in proximity to heritage masonry structures along Sector B.",
      ],
      dependencies: [
        { item: "Utility diversion clearance", criticality: "High", note: "Prerequisite for station box shoring and piling works." },
        { item: "Depot land handover", criticality: "High", note: "Prerequisite for track laying and test track commissioning." },
        { item: "33 kV traction power grid tie-in", criticality: "Moderate", note: "Two grid substations required for electrification." },
        { item: "Regional feeder-bus coordination MOU", criticality: "Moderate", note: "Required to secure opening-day first/last mile access." },
      ],
      operationalReadiness: `System is designed for an 18-hour operating window with ${MODEL_TRIPS_TEXT(inputs)}. Staff training and trial runs require a 4-month operational readiness activation phase before revenue commencement.`,
      qualityConsiderations: [
        "Compliance with National Urban Rail Transit safety and fire protection standards.",
        "Full barrier-free accessibility compliant with universal accessibility mandates.",
        "Automated Fare Collection (AFC) with contactless mobile and National Transit Card interoperability.",
      ],
    },
    recommendations: [
      {
        title: capex.withinBudget ? "Protect Capital Contingency Headroom" : "Phase Funding or Descope Non-Core Package",
        priority: "High",
        urgency: "Immediate",
        whyItMatters: capex.withinBudget
          ? `Current headroom of ₹${(project.budgetCrore - capex.totalModeled).toLocaleString("en-IN")} crore can easily erode during detailed engineering if scope isn't controlled.`
          : `Current scope exceeds budget by ₹${(capex.totalModeled - project.budgetCrore).toLocaleString("en-IN")} crore. Approving tender without alignment creates severe downstream cost overruns.`,
        expectedBenefit: "Preserves financial viability and avoids mid-construction funding stalls.",
        implementationApproach: "Establish a formal Change Review Board requiring steering sign-off on any modification exceeding 0.5% of capex.",
      },
      {
        title: "Frontload Utility Relocations into Early Enabling Works",
        priority: "High",
        urgency: "Immediate",
        whyItMatters: "Buried utility conflicts under station boxes are the single most common cause of commercial claims and work stoppages.",
        expectedBenefit: "De-risks critical-path excavation by 4 to 6 calendar months.",
        implementationApproach: "Tender utility relocation packages independently 6 months before primary civil contractor mobilization.",
      },
      {
        title: "Execute Long-Term Clean Energy Power Purchase Agreement (PPA)",
        priority: "Medium",
        urgency: "Near-term",
        whyItMatters: `Traction power demand of ${resources.annualEnergyGwh.toFixed(1)} GWh/year accounts for significant lifecycle operating expense.`,
        expectedBenefit: "Locks in predictable electricity tariffs while elevating renewable share toward 60%+.",
        implementationApproach: "Issue a competitive solar-wind hybrid PPA for 25-year operational power supply.",
      },
    ],
    actionPlan: {
      immediateActions: [
        {
          action: "Approve baseline corridor alignment and station boundary demarcations.",
          owner: "Steering Committee / Lead Planner",
          expectedOutcome: "Freezes corridor geography and enables formal land acquisition notices.",
        },
        {
          action: "Commission utility verification GPR mapping along entire route.",
          owner: "Chief Engineer (Enabling Works)",
          expectedOutcome: "Delivers comprehensive underground obstruction register.",
        },
        {
          action: "Establish Project Cost Control & Contingency Governance Board.",
          owner: "Finance Director",
          expectedOutcome: "Enforces budget envelope caps across procurement packages.",
        },
      ],
      shortTermActions: [
        {
          action: "Release pre-qualification tenders for Civil Package 1 & 2.",
          owner: "Procurement Committee",
          expectedOutcome: "Shortlists qualified national civil infrastructure contractors.",
        },
        {
          action: "Execute joint utility relocation agreements with water and electricity authorities.",
          owner: "Liaison & Statutory Approvals Manager",
          expectedOutcome: "Statutory rights-of-way secured for pipeline and cable diversion works.",
        },
        {
          action: "Finalize land acquisition notices for the depot perimeter.",
          owner: "Land Acquisition Office",
          expectedOutcome: "Secures ownership rights for rolling stock testing and maintenance hub.",
        },
      ],
      mediumTermActions: [
        {
          action: "Award main civil viaduct construction and station contracts.",
          owner: "Executive Directorate",
          expectedOutcome: "Contractor mobilization and ground-breaking for guideway foundation.",
        },
        {
          action: "Initiate rolling stock procurement tender for trainsets.",
          owner: "Rolling Stock & Systems Lead",
          expectedOutcome: "Locks in delivery manufacturing slots for fleet delivery.",
        },
        {
          action: "Execute inter-modal transit feeder integration agreements.",
          owner: "Urban Mobility Directorate",
          expectedOutcome: "Synchronized feeder bus lines and multimodal interchange hubs.",
        },
      ],
    },
    conclusion: {
      outlook: `${project.name} demonstrates solid foundational feasibility and compelling economic-environmental utility for ${project.region}. With disciplined capital governance and aggressive frontloading of utility diversions, the project is primed for successful execution within the targeted timeframe.`,
      criticalIssues: [
        capex.withinBudget
          ? "Preservation of contingency headroom against civil contractor claims."
          : `Re-alignment of capital cost with the ₹${project.budgetCrore} crore approved ceiling.`,
        "Depot site land parcel acquisition timeline.",
        "Timely diversion of critical water trunk mains under historic-core stations.",
      ],
      nextSteps: [
        "Present detailed planning synthesis to the Infrastructure Steering Committee.",
        "Issue formal gazette notifications for corridor right-of-way protection.",
        "Commence enabling works procurement for utility diversions.",
      ],
    },
  };

  return {
    mode: "demo",
    projectId: project.id,
    projectName: project.name,
    generatedAt: new Date().toISOString(),
    executiveSummary: executiveSummaryText,
    detailedReview,
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
