import type { AnalysisResult, Project, ReportContent, ScenarioInputs, ScenarioOutputs } from "@/lib/types";
import { formatCrore } from "@/lib/format";

/** Convert planning outputs into a structured, exportable report body. */

export function reportFromAnalysis(analysis: AnalysisResult): ReportContent {
  return {
    executiveSummary: analysis.executiveSummary,
    assumptions: analysis.assumptions,
    costBreakdown: analysis.costs.map((c) => ({ label: c.label, valueCrore: c.valueCrore, note: c.note })),
    milestones: [
      { phase: "Enabling works & utility diversions", window: "Months 0–14", detail: "GPR surveys, water/telecom diversions, tree removal under 3:1 policy." },
      { phase: "Civil package 1 (elevated sections)", window: "Months 10–38", detail: "Viaduct and at-grade sections outside the historic core." },
      { phase: "Civil package 2 (station boxes)", window: "Months 16–46", detail: "Cut-and-cover boxes, heritage vibration controls." },
      { phase: "Systems, rolling stock & commissioning", window: "Months 40–72", detail: "Track, power, signaling; fleet acceptance at depot." },
    ],
    riskRegister: analysis.risks,
    environmental: analysis.environmentalConstraints,
    recommendations: analysis.recommendations,
    evidence: analysis.evidence,
  };
}

export function reportFromScenarios(
  project: Project,
  scenarios: { inputs: ScenarioInputs; outputs: ScenarioOutputs }[],
): ReportContent {
  const cheapest = [...scenarios].sort((a, b) => a.outputs.capex.totalModeled - b.outputs.capex.totalModeled)[0];
  const greenest = [...scenarios].sort((a, b) => b.outputs.sustainability.score - a.outputs.sustainability.score)[0];
  const fastest = [...scenarios].sort((a, b) => a.outputs.schedule.estimatedYears - b.outputs.schedule.estimatedYears)[0];

  return {
    executiveSummary:
      `Scenario comparison for ${project.name}: ${scenarios.map((s) => s.inputs.name).join(", ")}. ` +
      `Modeled capex ranges from ${formatCrore(cheapest.outputs.capex.totalModeled)} (${cheapest.inputs.name}) to ` +
      `${formatCrore(Math.max(...scenarios.map((s) => s.outputs.capex.totalModeled)))}. ` +
      `${greenest.inputs.name} achieves the highest sustainability score (${greenest.outputs.sustainability.score}/100); ` +
      `${fastest.inputs.name} is the fastest at ${fastest.outputs.schedule.estimatedYears} years.`,
    assumptions: [
      "All scenarios evaluated with the same deterministic engine and unit rates — differences come only from input parameters.",
      "Unit rates: civil ₹150 cr/km, systems ₹41 cr/km, land ₹62 cr/station, contingency 12%.",
      "Outputs are illustrative planning aids, not validated cost forecasts.",
    ],
    costBreakdown: scenarios.map((s) => ({
      label: s.inputs.name,
      valueCrore: s.outputs.capex.totalModeled,
      note: `${s.inputs.corridorKm} km · ${s.inputs.stations} stations · ${s.outputs.capex.budgetUtilizationPct.toFixed(0)}% of envelope`,
    })),
    milestones: scenarios.map((s) => ({
      phase: s.inputs.name,
      window: `${s.outputs.schedule.estimatedYears} yrs modeled`,
      detail: `Risk ${s.outputs.risk.score}/100 (${s.outputs.risk.level}); demand coverage ${s.outputs.demand.demandCoveragePct.toFixed(0)}%.`,
    })),
    riskRegister: scenarios.map((s) => ({
      risk: `${s.inputs.name} — ${s.outputs.risk.drivers[0]}`,
      severity: s.outputs.risk.level,
      mitigation: s.outputs.capex.withinBudget ? "Monitor quarterly against envelope." : "Descope or phase funding before approval.",
    })),
    environmental: scenarios.map(
      (s) =>
        `${s.inputs.name}: sustainability ${s.outputs.sustainability.score}/100, ${s.outputs.sustainability.co2AvoidedTonsPerYear.toLocaleString("en-IN")} t CO₂ avoided/yr, ${s.outputs.sustainability.renewableSharePct}% renewable share.`,
    ),
    recommendations: [
      {
        title: `${greenest.inputs.name} leads on sustainability`,
        rationale: `Highest composite sustainability score (${greenest.outputs.sustainability.score}/100) driven by stated priorities and energy profile.`,
      },
      {
        title: `${cheapest.inputs.name} protects the envelope`,
        rationale: `Lowest modeled capex at ${formatCrore(cheapest.outputs.capex.totalModeled)} (${cheapest.outputs.capex.budgetUtilizationPct.toFixed(1)}% of envelope).`,
      },
      {
        title: "Trade-off framing",
        rationale: "Cost, schedule, capacity and sustainability move together in this model; select the scenario whose binding constraint the authority is most prepared to manage.",
      },
    ],
    evidence: [
      { label: "Scenario engine v1 (deterministic heuristics, this application)", kind: "Internal analysis" },
      { label: "Illustrative unit-rate schedule (demo constants)", kind: "Illustrative" },
    ],
  };
}
