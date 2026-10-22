"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileDown,
  FlaskConical,
  Info,
  Loader2,
  RotateCcw,
  Sigma,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "@/components/providers/AppProvider";
import { PageHeader, RiskTag } from "@/components/ui";
import {
  DEFAULT_SCENARIOS,
  MODEL_CONSTANTS,
  INPUT_BOUNDS,
  runMonteCarlo,
  runScenario,
  validateInputs,
} from "@/lib/simulation";
import { reportFromScenarios } from "@/lib/report-builder";
import { cx, formatCrore, formatNumber } from "@/lib/format";
import type { MonteCarloResult, ScenarioInputs } from "@/lib/types";

const PRIO_OPTIONS = [
  "Low-carbon construction",
  "Renewable traction power",
  "Transit-oriented development",
  "Recycled materials",
];

const CHART_COLOR = "#F2F3F5";

export default function DigitalTwinPage() {
  const { settings, featuredProject, recordSimRun, createReport } = useApp();
  const [scenarios, setScenarios] = useState<ScenarioInputs[]>(DEFAULT_SCENARIOS.map((s) => ({ ...s })));
  const [activeIdx, setActiveIdx] = useState(0);
  const [outputs, setOutputs] = useState(() => DEFAULT_SCENARIOS.map((s) => runScenario(s)));
  const [mc, setMc] = useState<MonteCarloResult | null>(null);
  const [mcBusy, setMcBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportCreated, setReportCreated] = useState<string | null>(null);

  const [prevSettings, setPrevSettings] = useState(settings);
  if (settings !== prevSettings && !dirty) {
    setPrevSettings(settings);
    if (
      settings.defaultBudgetCrore !== DEFAULT_SCENARIOS[0].budgetCrore ||
      settings.defaultStations !== DEFAULT_SCENARIOS[0].stations
    ) {
      setScenarios((prev) => {
        const next = [...prev];
        next[0] = {
          ...next[0],
          budgetCrore: settings.defaultBudgetCrore,
          stations: settings.defaultStations,
          corridorKm: settings.defaultCorridorKm,
          constructionYears: settings.defaultYears,
        };
        return next;
      });
      setOutputs((prev) => {
        const next = [...prev];
        next[0] = runScenario({
          ...next[0],
          ...scenarios[0],
          budgetCrore: settings.defaultBudgetCrore,
          stations: settings.defaultStations,
          corridorKm: settings.defaultCorridorKm,
          constructionYears: settings.defaultYears,
        });
        return next;
      });
    }
  }

  const errors = useMemo(() => validateInputs(scenarios[activeIdx]), [scenarios, activeIdx]);
  const out = outputs[activeIdx];
  const active = scenarios[activeIdx];

  const setParam = <K extends keyof ScenarioInputs>(key: K, value: ScenarioInputs[K]) => {
    setDirty(true);
    setScenarios((prev) => {
      const next = [...prev];
      next[activeIdx] = { ...next[activeIdx], [key]: value };
      return next;
    });
    setReportCreated(null);
  };

  const runAll = () => {
    if (errors.length > 0) return;
    setOutputs(scenarios.map((s) => runScenario(s)));
    setMc(null);
    setDirty(false);
    recordSimRun(3);
  };

  const resetPresets = () => {
    setScenarios(DEFAULT_SCENARIOS.map((s) => ({ ...s })));
    setOutputs(DEFAULT_SCENARIOS.map((s) => runScenario(s)));
    setMc(null);
    setDirty(false);
  };

  const runMc = () => {
    setMcBusy(true);
    // defer so the spinner paints; calculation itself takes ~1ms
    setTimeout(() => {
      setMc(runMonteCarlo(scenarios[activeIdx], 500, 4217));
      setMcBusy(false);
    }, 60);
  };

  const makeReport = async () => {
    if (!featuredProject) return;
    setReportBusy(true);
    try {
      const triples = scenarios.map((inputs, i) => ({ inputs, outputs: outputs[i] }));
      const content = reportFromScenarios(featuredProject, triples);
      const report = await createReport({
        projectId: featuredProject.id,
        title: `${featuredProject.name} — Scenario Comparison`,
        reportType: "Scenario Comparison",
        status: "Draft",
        content,
      });
      setReportCreated(report.id);
      recordSimRun(0);
    } finally {
      setReportBusy(false);
    }
  };

  const capexChart = [
    { name: "Civil works", value: out.capex.civil },
    { name: "Systems", value: out.capex.systems },
    { name: "Land", value: out.capex.land },
    { name: "Rolling stock", value: Math.round(out.capex.rollingStock) },
    { name: "Contingency", value: out.capex.contingency },
  ];

  const comparison = [
    { key: "capex", label: "Modeled capex", get: (o: typeof out) => o.capex.totalModeled, fmt: (v: number) => formatCrore(v, settings.currency) },
    { key: "duration", label: "Modeled duration (yrs)", get: (o: typeof out) => o.schedule.estimatedYears, fmt: (v: number) => `${v}` },
    { key: "risk", label: "Risk score", get: (o: typeof out) => o.risk.score, fmt: (v: number) => `${v}/100` },
    { key: "sustain", label: "Sustainability score", get: (o: typeof out) => o.sustainability.score, fmt: (v: number) => `${v}/100` },
    { key: "energy", label: "Annual energy (GWh)", get: (o: typeof out) => o.resources.annualEnergyGwh, fmt: (v: number) => `${v}` },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Digital Twin — Scenario Simulation"
        subtitle="Compare execution strategies with a documented, deterministic scenario engine."
        actions={
          <button type="button" className="btn btn-secondary" onClick={makeReport} disabled={reportBusy}>
            {reportBusy ? <Loader2 size={13.5} className="animate-spin" aria-hidden /> : <FileDown size={13.5} aria-hidden />}
            {reportBusy ? "Saving…" : "Save comparison report"}
          </button>
        }
      />

      {reportCreated && (
        <div className="anim-pop mb-4 flex items-center justify-between gap-2 rounded-md border border-[#1F4A3C] bg-success-soft px-4 py-2.5 text-[12.5px] text-success" role="status">
          <span className="flex items-center gap-2"><CheckCircle2 size={15} aria-hidden /> Scenario comparison saved as report {reportCreated}.</span>
          <Link href={`/reports?open=${reportCreated}`} className="font-semibold underline underline-offset-2">Open in Reports</Link>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        {/* Configuration panel */}
        <section className="card h-fit xl:sticky xl:top-[72px]" aria-label="Scenario configuration">
          <div className="card-header">
            <p className="card-title">Scenario controls</p>
          </div>
          <div className="border-b border-line p-2">
            <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="Scenario presets">
              {scenarios.map((s, i) => (
                <button
                  key={s.name}
                  role="tab"
                  aria-selected={activeIdx === i}
                  onClick={() => setActiveIdx(i)}
                  className={cx(
                    "rounded px-1.5 py-1.5 text-[10.5px] font-semibold leading-tight transition-colors",
                    activeIdx === i ? "bg-primary text-[#0A0B0D]" : "bg-app-bg text-muted hover:text-ink",
                  )}
                >
                  {s.name.replace(" Plan", "")}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3 p-4">
            <NumField k="budgetCrore" v={active.budgetCrore} onChange={(v) => setParam("budgetCrore", v)} />
            <NumField k="stations" v={active.stations} onChange={(v) => setParam("stations", v)} />
            <NumField k="corridorKm" v={active.corridorKm} onChange={(v) => setParam("corridorKm", v)} />
            <NumField k="dailyRidership" v={active.dailyRidership} onChange={(v) => setParam("dailyRidership", v)} />
            <NumField k="constructionYears" v={active.constructionYears} step={0.5} onChange={(v) => setParam("constructionYears", v)} />
            <NumField k="trainCapacityPerHour" v={active.trainCapacityPerHour} step={500} onChange={(v) => setParam("trainCapacityPerHour", v)} />
            <NumField k="energyKwhPerTrainKm" v={active.energyKwhPerTrainKm} onChange={(v) => setParam("energyKwhPerTrainKm", v)} />

            <fieldset>
              <legend className="label">Sustainability priorities</legend>
              <div className="flex flex-wrap gap-1.5">
                {PRIO_OPTIONS.map((p) => {
                  const on = active.sustainabilityPriorities.includes(p);
                  return (
                    <button key={p} type="button" aria-pressed={on}
                      onClick={() =>
                        setParam(
                          "sustainabilityPriorities",
                          on ? active.sustainabilityPriorities.filter((x) => x !== p) : [...active.sustainabilityPriorities, p],
                        )
                      }
                      className={cx("rounded border px-2 py-1 text-[10.5px] transition-colors",
                        on ? "border-[#3A404B] bg-primary-soft font-medium text-primary-hover" : "border-line bg-surface text-muted hover:text-ink")}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {errors.length > 0 && (
              <div className="rounded-md border border-[#4D2727] bg-critical-soft px-3 py-2" role="alert">
                {errors.map((e) => (
                  <p key={e} className="flex items-start gap-1.5 text-[11px] leading-4.5 text-critical">
                    <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden /> {e}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" className="btn btn-primary flex-1" onClick={runAll} disabled={errors.length > 0}>
                <FlaskConical size={13.5} aria-hidden /> Run simulation
              </button>
              <button type="button" className="btn btn-ghost" onClick={resetPresets} title="Reset to presets">
                <RotateCcw size={13.5} aria-hidden /> Reset
              </button>
            </div>
            {dirty && errors.length === 0 && (
              <p className="flex items-center gap-1.5 text-[10.5px] text-warning">
                <Info size={11} aria-hidden /> Parameters changed — re-run to refresh results.
              </p>
            )}
          </div>
        </section>

        {/* Results */}
        <div className="space-y-4">
          {/* KPI strip */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Scenario results">
            <Kpi label="Modeled capex" value={formatCrore(out.capex.totalModeled, settings.currency)}
              sub={`${out.capex.budgetUtilizationPct.toFixed(1)}% of envelope`} bad={!out.capex.withinBudget} />
            <Kpi label="Modeled duration" value={`${out.schedule.estimatedYears} yrs`}
              sub={out.schedule.schedulePressurePct > 0 ? `${out.schedule.schedulePressurePct.toFixed(1)}% over target` : "inside target"} bad={out.schedule.schedulePressurePct > 5} />
            <Kpi label="Demand coverage" value={`${out.demand.demandCoveragePct.toFixed(0)}%`}
              sub={`${formatNumber(out.demand.dailyCapacityOffered)} riders/day offered`} />
            <Kpi label="Peak crowding" value={`${out.demand.peakCrowdingIndex.toFixed(2)}×`}
              sub="practical capacity" bad={out.demand.peakCrowdingIndex > 1} />
            <Kpi label="Fleet" value={`${out.resources.fleetTrains}`} sub={`${out.resources.annualEnergyGwh} GWh/yr traction`} />
            <Kpi label="Staff estimate" value={formatNumber(out.resources.staffEstimate)} sub="operations FTE" />
            <div className="card px-4 py-3">
              <p className="text-[11px] font-medium text-muted">Composite risk</p>
              <p className="mt-1 text-[20px] font-semibold leading-tight text-ink">{out.risk.score}<span className="text-[12px] text-muted">/100</span></p>
              <div className="mt-1"><RiskTag level={out.risk.level} /></div>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[11px] font-medium text-muted">Sustainability</p>
              <p className="mt-1 text-[20px] font-semibold leading-tight text-ink">{out.sustainability.score}<span className="text-[12px] text-muted">/100</span></p>
              <p className="mt-1 text-[10.5px] text-faint">{formatNumber(out.sustainability.co2AvoidedTonsPerYear)} t CO₂ avoided/yr</p>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Capex breakdown */}
            <section className="card" aria-label="Capex breakdown">
              <div className="card-header">
                <p className="card-title">Modeled capex breakdown — {active.name}</p>
              </div>
              <div className="h-[210px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={capexChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid stroke="#24272E" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={86} />
                    <RTooltip formatter={(v) => formatCrore(Number(v), settings.currency)} contentStyle={{ fontSize: 11.5, borderRadius: 6, border: "1px solid #23262C", backgroundColor: "#14171A", color: "#ECEDEF" }} />
                    <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={16}>
                      {capexChart.map((d) => (
                        <Cell key={d.name} fill={d.name === "Contingency" ? "#D2A24C" : CHART_COLOR} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Metric comparison */}
            <section className="card" aria-label="Scenario comparison charts">
              <div className="card-header">
                <p className="card-title">Side-by-side comparison</p>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-4 p-4 sm:grid-cols-3">
                {comparison.map((c) => (
                  <MiniCompare
                    key={c.key}
                    label={c.label}
                    rows={scenarios.map((s, i) => ({ name: s.name.split(" ")[0], value: c.get(outputs[i]), active: i === activeIdx }))}
                    fmt={c.fmt}
                  />
                ))}
              </div>
            </section>
          </div>

          {/* Comparison table */}
          <section className="card" aria-label="Scenario comparison table">
            <div className="card-header">
              <p className="card-title">Comparison register</p>
              <p className="card-sub">Δ vs Baseline shown in parentheses</p>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Metric</th>
                    {scenarios.map((s, i) => (
                      <th key={s.name} className={cx(i === activeIdx && "text-primary")}>{s.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((c) => {
                    const base = c.get(outputs[0]);
                    return (
                      <tr key={c.key}>
                        <td className="font-medium text-ink">{c.label}</td>
                        {scenarios.map((s, i) => {
                          const v = c.get(outputs[i]);
                          const delta = i === 0 ? "" : v === base ? " (±0)" : ` (${v > base ? "+" : ""}${typeof v === "number" && v % 1 !== 0 ? (v - base).toFixed(1) : formatDelta(v - base)})`;
                          return (
                            <td key={s.name} className={cx(i === activeIdx && "bg-primary-soft/40 font-medium text-ink")}>
                              {c.fmt(v)}
                              <span className="text-faint">{delta}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="font-medium text-ink">Risk level</td>
                    {outputs.map((o, i) => (
                      <td key={i} className={cx(i === activeIdx && "bg-primary-soft/40")}><RiskTag level={o.risk.level} /></td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="border-t border-line px-4 py-3 text-[11.5px] leading-5 text-muted">
              <span className="font-medium text-ink-2">Trade-off reading:</span> cutting scope lowers capex and risk but reduces coverage
              and CO₂ benefit; the sustainability plan raises both sustainability score and capex. The baseline keeps
              envelope headroom above 8% while meeting demand coverage targets — the classic cost–time–capacity–sustainability balance.
            </div>
          </section>

          {/* Monte Carlo */}
          <section className="card" aria-label="Uncertainty analysis">
            <div className="card-header">
              <div>
                <p className="card-title">Uncertainty analysis — {active.name}</p>
                <p className="card-sub mt-0.5">Actual Monte Carlo trials over documented uncertainty ranges</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={runMc} disabled={mcBusy}>
                {mcBusy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Sigma size={13} aria-hidden />}
                {mc ? "Re-run (500 trials)" : "Run 500 trials"}
              </button>
            </div>
            {!mc ? (
              <div className="p-4 text-[12px] leading-5 text-muted">
                Not run yet. This executes 500 real sampling trials with a fixed seed over the active scenario’s
                cost and schedule parameters — deterministic results identical across machines.
              </div>
            ) : (
              <div className="grid gap-4 p-4 lg:grid-cols-2">
                <div>
                  <div className="grid grid-cols-3 gap-2">
                    <Percentile label="P10 cost" v={formatCrore(mc.costCrore.p10, settings.currency)} />
                    <Percentile label="P50 cost" v={formatCrore(mc.costCrore.p50, settings.currency)} highlight />
                    <Percentile label="P90 cost" v={formatCrore(mc.costCrore.p90, settings.currency)} warn />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Percentile label="P10 duration" v={`${mc.durationYears.p10} yrs`} />
                    <Percentile label="P50 duration" v={`${mc.durationYears.p50} yrs`} highlight />
                    <Percentile label="P90 duration" v={`${mc.durationYears.p90} yrs`} warn />
                  </div>
                  <ul className="mt-3 space-y-1">
                    {mc.assumptions.map((a) => (
                      <li key={a} className="flex items-start gap-1.5 text-[10.5px] leading-4 text-muted">
                        <Info size={10} className="mt-0.5 shrink-0 text-faint" aria-hidden /> {a}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mc.histogram}>
                      <CartesianGrid stroke="#24272E" vertical={false} />
                      <XAxis dataKey="bucket" />
                      <YAxis width={30} />
                      <RTooltip contentStyle={{ fontSize: 11.5, borderRadius: 6, border: "1px solid #23262C", backgroundColor: "#14171A", color: "#ECEDEF" }} formatter={(v) => [`${v} trials`, "Count"]} />
                      <Bar dataKey="count" fill={CHART_COLOR} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>

          {/* Assumptions */}
          <section className="card" aria-label="Model assumptions">
            <div className="card-header"><p className="card-title">Documented model assumptions</p></div>
            <div className="grid gap-x-8 gap-y-1.5 p-4 text-[11.5px] text-muted sm:grid-cols-2">
              <Assumption k="Civil works" v={`₹${MODEL_CONSTANTS.CIVIL_PER_KM} cr per route-km`} />
              <Assumption k="Systems & signaling" v={`₹${MODEL_CONSTANTS.SYSTEMS_PER_KM} cr per route-km`} />
              <Assumption k="Land & integration" v={`₹${MODEL_CONSTANTS.LAND_PER_STATION} cr per station`} />
              <Assumption k="Rolling stock" v={`₹${MODEL_CONSTANTS.ROLLING_STOCK_PER_TRAIN} cr per 4-car train`} />
              <Assumption k="Contingency" v={`${MODEL_CONSTANTS.CONTINGENCY_PCT * 100}% of direct costs`} />
              <Assumption k="Construction throughput" v={`${MODEL_CONSTANTS.KM_PER_YEAR} km/yr + ${MODEL_CONSTANTS.YEARS_PER_STATION} yr per station box`} />
              <Assumption k="Capacity model" v={`${MODEL_CONSTANTS.OPERATING_HOURS}h/day × practical factor ${MODEL_CONSTANTS.PRACTICAL_FACTOR}`} />
              <Assumption k="Modal shift / CO₂" v={`${MODEL_CONSTANTS.MODAL_SHIFT * 100}% shift · ${MODEL_CONSTANTS.CO2_PER_ROAD_PAX_KM} kg/pax-km`} />
            </div>
            <div className="border-t border-line px-4 py-3 text-[10.5px] leading-4.5 text-faint">
              Demonstrative heuristics for reproducible demo output — not a physically accurate digital-twin simulation
              and not a validated Monte Carlo forecast.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function NumField({
  k, v, onChange, step,
}: {
  k: keyof typeof INPUT_BOUNDS;
  v: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  const b = INPUT_BOUNDS[k];
  return (
    <div>
      <label className="label" htmlFor={`f-${k}`}>{b.label}</label>
      <input
        id={`f-${k}`}
        type="number"
        className="input"
        value={Number.isFinite(v) ? v : ""}
        min={b.min}
        max={b.max}
        step={step ?? b.step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <p className="mt-0.5 text-[9.5px] text-faint">
        Bounds: {b.min.toLocaleString("en-IN")} – {b.max.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, bad }: { label: string; value: string; sub: string; bad?: boolean }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className={cx("mt-1 text-[20px] font-semibold leading-tight", bad ? "text-critical" : "text-ink")}>{value}</p>
      <p className={cx("mt-0.5 text-[10.5px]", bad ? "text-critical" : "text-faint")}>{sub}</p>
    </div>
  );
}

function MiniCompare({
  label, rows, fmt,
}: {
  label: string;
  rows: { name: string; value: number; active: boolean }[];
  fmt: (v: number) => string;
}) {
  const data = rows.map((r) => ({ ...r, label: r.name }));
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</p>
      <div className="h-[86px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <RTooltip formatter={(v) => fmt(Number(v))} contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #23262C", backgroundColor: "#14171A", color: "#ECEDEF" }} cursor={{ fill: "rgba(53,92,125,0.06)" }} />
            <Bar dataKey="value" radius={[2, 2, 0, 0]} barSize={22}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.active ? "#F2F3F5" : "#3A404B"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Percentile({ label, v, highlight, warn }: { label: string; v: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div className={cx("rounded-md border px-3 py-2", highlight ? "border-[#3A404B] bg-primary-soft/50" : warn ? "border-[#4A3B1E] bg-warning-soft/60" : "border-line bg-app-bg")}>
      <p className="text-[9.5px] font-semibold uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-0.5 text-[13.5px] font-bold text-ink">{v}</p>
    </div>
  );
}

function Assumption({ k, v }: { k: string; v: string }) {
  return (
    <p className="flex items-baseline justify-between gap-3 border-b border-line py-1">
      <span className="text-muted">{k}</span>
      <span className="font-medium text-ink-2">{v}</span>
    </p>
  );
}

function formatDelta(d: number): string {
  return Number.isInteger(d) ? d.toLocaleString("en-IN") : d.toFixed(1);
}
