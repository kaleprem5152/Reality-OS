import type {
  MonteCarloResult,
  RiskLevel,
  ScenarioInputs,
  ScenarioOutputs,
} from "@/lib/types";
import { clamp } from "@/lib/format";

/**
 * RealityOS deterministic scenario engine.
 *
 * These are demonstrative engineering heuristics — NOT validated cost or
 * ridership models. Every constant is documented so results are reproducible
 * and explainable. No randomness is used anywhere in runScenario();
 * runMonteCarlo() uses a seeded PRNG and executes real repeated trials.
 */

export const MODEL_CONSTANTS = {
  CIVIL_PER_KM: 150, // ₹ crore per route-km (guideway, tunnels, stations shell)
  SYSTEMS_PER_KM: 41, // ₹ crore per route-km (track, power, signaling, telecoms)
  LAND_PER_STATION: 62, // ₹ crore per station (land assembly + urban integration)
  ROLLING_STOCK_PER_TRAIN: 9.5, // ₹ crore per 4-car train
  CONTINGENCY_PCT: 0.12, // on direct costs
  KM_PER_YEAR: 11.8, // base construction throughput
  YEARS_PER_STATION: 0.06, // added per station (box construction)
  OPERATING_HOURS: 18,
  PRACTICAL_FACTOR: 0.75, // practical capacity vs theoretical
  PEAK_HOUR_SHARE: 0.11, // share of daily ridership in the peak hour
  PEAK_FACTOR: 0.85, // peak-hour practical capacity
  TRIPS_PER_DIRECTION_PER_DAY: 22,
  AVG_TRIP_KM: 8.5,
  MODAL_SHIFT: 0.28, // share of riders shifted from road modes
  CO2_PER_ROAD_PAX_KM: 0.121, // kg CO2 avoided per shifted passenger-km
  STAFF_PER_STATION: 22,
  STAFF_PER_KM: 6,
  STAFF_PER_TRAIN: 8,
} as const;

export const INPUT_BOUNDS = {
  budgetCrore: { min: 500, max: 60000, step: 100, label: "Capital budget (₹ crore)" },
  stations: { min: 5, max: 80, step: 1, label: "Stations" },
  corridorKm: { min: 5, max: 150, step: 1, label: "Corridor length (km)" },
  dailyRidership: { min: 50000, max: 1500000, step: 10000, label: "Daily ridership (passengers/day)" },
  constructionYears: { min: 3, max: 15, step: 0.5, label: "Construction duration (years)" },
  trainCapacityPerHour: { min: 4000, max: 45000, step: 500, label: "Train capacity (passengers/hour/direction)" },
  energyKwhPerTrainKm: { min: 8, max: 40, step: 1, label: "Traction energy (kWh/train-km)" },
} as const;

export const BASELINE_SCENARIO: ScenarioInputs = {
  name: "Baseline Plan",
  budgetCrore: 18500,
  stations: 42,
  corridorKm: 68,
  dailyRidership: 480000,
  constructionYears: 8,
  trainCapacityPerHour: 15000,
  energyKwhPerTrainKm: 19,
  sustainabilityPriorities: ["Low-carbon construction", "Transit-oriented development"],
};

export const BUDGET_OPTIMIZED: ScenarioInputs = {
  name: "Budget-Optimized Plan",
  budgetCrore: 14200,
  stations: 36,
  corridorKm: 58,
  dailyRidership: 410000,
  constructionYears: 7.5,
  trainCapacityPerHour: 13500,
  energyKwhPerTrainKm: 17,
  sustainabilityPriorities: ["Recycled materials"],
};

export const SUSTAINABILITY_OPTIMIZED: ScenarioInputs = {
  name: "Sustainability-Optimized Plan",
  budgetCrore: 21900,
  stations: 44,
  corridorKm: 72,
  dailyRidership: 520000,
  constructionYears: 9,
  trainCapacityPerHour: 16000,
  energyKwhPerTrainKm: 15,
  sustainabilityPriorities: [
    "Renewable traction power",
    "Low-carbon construction",
    "Transit-oriented development",
  ],
};

export const DEFAULT_SCENARIOS: ScenarioInputs[] = [
  BASELINE_SCENARIO,
  BUDGET_OPTIMIZED,
  SUSTAINABILITY_OPTIMIZED,
];

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 72) return "Critical";
  if (score >= 55) return "High";
  if (score >= 35) return "Moderate";
  return "Low";
}

export function runScenario(inputs: ScenarioInputs): ScenarioOutputs {
  const K = MODEL_CONSTANTS;
  const { budgetCrore, stations, corridorKm, dailyRidership, constructionYears } = inputs;

  const civil = Math.round(corridorKm * K.CIVIL_PER_KM);
  const systems = Math.round(corridorKm * K.SYSTEMS_PER_KM);
  const land = Math.round(stations * K.LAND_PER_STATION);
  const fleetTrains = Math.max(6, Math.ceil(corridorKm / 2.5) + Math.ceil(dailyRidership / 120000));
  const rollingStock = Math.round(fleetTrains * K.ROLLING_STOCK_PER_TRAIN * 10) / 10;
  const contingency = Math.round((civil + systems + land + rollingStock) * K.CONTINGENCY_PCT);
  const totalModeled = civil + systems + land + rollingStock + contingency;
  const budgetUtilizationPct = Math.round((totalModeled / budgetCrore) * 1000) / 10;

  const estimatedYears =
    Math.round((corridorKm / K.KM_PER_YEAR + stations * K.YEARS_PER_STATION) * 10) / 10;
  const schedulePressurePct = Math.round(((estimatedYears / constructionYears) - 1) * 1000) / 10;

  const offeredCapacity =
    inputs.trainCapacityPerHour * K.OPERATING_HOURS * 2 * K.PRACTICAL_FACTOR;
  const demandCoveragePct = Math.round((offeredCapacity / dailyRidership) * 1000) / 10;
  const peakDemand = dailyRidership * K.PEAK_HOUR_SHARE;
  const peakOffered = inputs.trainCapacityPerHour * 2 * K.PEAK_FACTOR;
  const peakCrowdingIndex = Math.round((peakDemand / peakOffered) * 100) / 100;

  const dailyTrainKm = corridorKm * 2 * K.TRIPS_PER_DIRECTION_PER_DAY;
  const annualEnergyGwh =
    Math.round(((inputs.energyKwhPerTrainKm * dailyTrainKm * 365) / 1e6) * 10) / 10;
  const staffEstimate =
    stations * K.STAFF_PER_STATION + Math.round(corridorKm * K.STAFF_PER_KM) + fleetTrains * K.STAFF_PER_TRAIN;

  // Risk: weighted composite of budget pressure, schedule pressure and crowding.
  const budgetPressure = clamp(((totalModeled / budgetCrore) - 0.85) * 200, 0, 40);
  const schedPressure = clamp(schedulePressurePct * 1.2, -20, 25);
  const crowdPressure = clamp((peakCrowdingIndex - 1) * 45, 0, 25);
  const densityPressure = clamp((stations / corridorKm - 0.55) * 30, 0, 10);
  const score = Math.round(clamp(28 + budgetPressure + schedPressure + crowdPressure + densityPressure, 5, 98));
  const drivers: string[] = [];
  if (budgetUtilizationPct > 100) drivers.push(`Modeled capex exceeds budget by ${(budgetUtilizationPct - 100).toFixed(1)}%`);
  else if (budgetUtilizationPct > 92) drivers.push("Budget headroom below 8% — limited contingency margin");
  if (schedulePressurePct > 0) drivers.push(`Modeled duration ${schedulePressurePct.toFixed(1)}% above target`);
  if (peakCrowdingIndex > 1) drivers.push(`Peak-hour demand ${(peakCrowdingIndex * 100).toFixed(0)}% of practical capacity`);
  if (drivers.length === 0) drivers.push("Scenario sits inside all planning tolerances");

  // Sustainability: composite of mode shift potential and stated priorities.
  const prioBonus = Math.min(3, inputs.sustainabilityPriorities.length) * 9;
  const efficiencyBonus = clamp((20 - inputs.energyKwhPerTrainKm) * 1.4, 0, 10);
  const coverageBonus = clamp((demandCoveragePct - 60) * 0.25, 0, 8);
  const renewableSharePct = clamp(
    35 + inputs.sustainabilityPriorities.filter((p) => p.toLowerCase().includes("renewable")).length * 25,
    20, 80,
  );
  const sustainScore = Math.round(clamp(38 + prioBonus + efficiencyBonus + coverageBonus + (renewableSharePct - 40) * 0.4, 5, 97));
  const co2AvoidedTonsPerYear = Math.round(
    (dailyRidership * K.MODAL_SHIFT * K.AVG_TRIP_KM * K.CO2_PER_ROAD_PAX_KM * 365) / 1000,
  );

  return {
    capex: {
      civil, systems, rollingStock, land, contingency,
      totalModeled, budgetUtilizationPct, withinBudget: totalModeled <= budgetCrore,
    },
    schedule: { estimatedYears, schedulePressurePct },
    demand: {
      dailyCapacityOffered: Math.round(offeredCapacity),
      demandCoveragePct,
      peakCrowdingIndex,
    },
    resources: { annualEnergyGwh, fleetTrains, staffEstimate },
    risk: { score, level: riskLevelFromScore(score), drivers },
    sustainability: { score: sustainScore, co2AvoidedTonsPerYear, renewableSharePct },
  };
}

/* ------------------------------ Monte Carlo ------------------------------ */

/** Deterministic seeded PRNG (Lehmer/LCG) so demo runs are reproducible. */
function makePrng(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** Triangular distribution sample in [min, max] with mode c. */
function triangular(rand: () => number, min: number, mode: number, max: number) {
  const u = rand();
  const c = (mode - min) / (max - min);
  if (u < c) return min + Math.sqrt(u * (max - min) * (mode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function percentile(sorted: number[], p: number) {
  const idx = clamp(Math.ceil((p / 100) * sorted.length) - 1, 0, sorted.length - 1);
  return sorted[idx];
}

/**
 * Real Monte Carlo trials (default 500) with a fixed seed.
 * Uncertainty: civil unit cost ±18% triangular, systems ±12%, land ±25%,
 * schedule ±20%. Assumptions are listed in MonteCarloResult.assumptions.
 */
export function runMonteCarlo(inputs: ScenarioInputs, trials = 500, seed = 4217): MonteCarloResult {
  const K = MODEL_CONSTANTS;
  const rand = makePrng(seed);
  const costs: number[] = [];
  const durations: number[] = [];
  for (let i = 0; i < trials; i++) {
    const civil = inputs.corridorKm * triangular(rand, K.CIVIL_PER_KM * 0.82, K.CIVIL_PER_KM, K.CIVIL_PER_KM * 1.18);
    const systems = inputs.corridorKm * triangular(rand, K.SYSTEMS_PER_KM * 0.88, K.SYSTEMS_PER_KM, K.SYSTEMS_PER_KM * 1.12);
    const land = inputs.stations * triangular(rand, K.LAND_PER_STATION * 0.75, K.LAND_PER_STATION, K.LAND_PER_STATION * 1.25);
    const fleet = Math.max(6, Math.ceil(inputs.corridorKm / 2.5) + Math.ceil(inputs.dailyRidership / 120000));
    const stock = fleet * K.ROLLING_STOCK_PER_TRAIN;
    const total = (civil + systems + land + stock) * (1 + K.CONTINGENCY_PCT);
    costs.push(total);
    const years = (inputs.corridorKm / K.KM_PER_YEAR + inputs.stations * K.YEARS_PER_STATION) * triangular(rand, 0.85, 1, 1.2);
    durations.push(years);
  }
  costs.sort((a, b) => a - b);
  durations.sort((a, b) => a - b);

  const buckets = 12;
  const lo = costs[0];
  const hi = costs[costs.length - 1];
  const width = (hi - lo) / buckets || 1;
  const hist = new Array(buckets).fill(0);
  for (const c of costs) hist[clamp(Math.floor((c - lo) / width), 0, buckets - 1)]++;
  const histogram = hist.map((count, i) => ({
    bucket: `${Math.round((lo + i * width) / 100) / 10}k`,
    count,
  }));

  const r1 = (n: number) => Math.round(n / 10) * 10;
  const r2 = (n: number) => Math.round(n * 10) / 10;
  return {
    trials,
    costCrore: { p10: r1(percentile(costs, 10)), p50: r1(percentile(costs, 50)), p90: r1(percentile(costs, 90)) },
    durationYears: {
      p10: r2(percentile(durations, 10)),
      p50: r2(percentile(durations, 50)),
      p90: r2(percentile(durations, 90)),
    },
    histogram,
    assumptions: [
      "Fixed seed (4217) — identical inputs always produce identical results.",
      "Independent triangular uncertainty: civil unit cost ±18%, systems ±12%, land ±25%, schedule ±20%.",
      "No correlation between line items is modeled; contingency held at a fixed 12%.",
      "This is a demonstrative uncertainty illustration, not a validated cost-risk model.",
    ],
  };
}

export function validateInputs(inputs: ScenarioInputs): string[] {
  const errors: string[] = [];
  const B = INPUT_BOUNDS;
  const checks: [keyof typeof B, number][] = [
    ["budgetCrore", inputs.budgetCrore],
    ["stations", inputs.stations],
    ["corridorKm", inputs.corridorKm],
    ["dailyRidership", inputs.dailyRidership],
    ["constructionYears", inputs.constructionYears],
    ["trainCapacityPerHour", inputs.trainCapacityPerHour],
    ["energyKwhPerTrainKm", inputs.energyKwhPerTrainKm],
  ];
  for (const [key, val] of checks) {
    if (!Number.isFinite(val)) errors.push(`${B[key].label}: enter a valid number`);
    else if (val < B[key].min || val > B[key].max)
      errors.push(`${B[key].label}: must be between ${B[key].min.toLocaleString("en-IN")} and ${B[key].max.toLocaleString("en-IN")}`);
  }
  return errors;
}
