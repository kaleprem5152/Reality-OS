"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Eye,
  FileDown,
  FlaskConical,
  FolderOpen,
  Info,
  Layers,
  Loader2,
  MapPin,
  Radio,
  RotateCcw,
  ShieldAlert,
  Sigma,
  Zap,
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
import { EmptyState, LoadingBlock, PageHeader, RiskTag, StatusTag } from "@/components/ui";
import {
  MODEL_CONSTANTS,
  INPUT_BOUNDS,
  runMonteCarlo,
  runScenario,
  validateInputs,
} from "@/lib/simulation";
import { reportFromScenarios } from "@/lib/report-builder";
import { cx, formatCrore, formatNumber } from "@/lib/format";
import type { MonteCarloResult, Project, ScenarioInputs } from "@/lib/types";

const PRIO_OPTIONS = [
  "Low-carbon construction",
  "Renewable traction power",
  "Transit-oriented development",
  "Recycled materials",
];

const CHART_COLOR = "#F2F3F5";

/** Build scenarios derived dynamically from the selected project's parameters. */
function buildScenariosForProject(project: Project): ScenarioInputs[] {
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

interface SimulatedStationNode {
  index: number;
  name: string;
  type: "Terminal" | "Interchange" | "Standard";
  chainageKm: number;
  powerDrawKw: number;
  throughputPaxHr: number;
  healthScore: number;
  riskFactor: "Low" | "Moderate" | "High";
}

function DigitalTwinInner() {
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("project") || "";

  const { projects, activeProjects, settings, recordSimRun, createReport, loading } = useApp();

  // Selected project state
  const [selectedId, setSelectedId] = useState<string>(() => queryProjectId || "");
  const [activeTab, setActiveTab] = useState<"simulation" | "alignment">("simulation");

  // Keep query param in sync if URL changes
  const [prevParamsStr, setPrevParamsStr] = useState(() => searchParams.toString());
  if (searchParams.toString() !== prevParamsStr) {
    setPrevParamsStr(searchParams.toString());
    const p = searchParams.get("project");
    if (p) setSelectedId(p);
  }

  const selectedProject: Project | null = useMemo(() => {
    if (selectedId) {
      const match = projects.find((p) => p.id === selectedId);
      if (match) return match;
    }
    return activeProjects[0] ?? projects[0] ?? null;
  }, [projects, activeProjects, selectedId]);

  // Scenarios derived from selected project
  const [scenarios, setScenarios] = useState<ScenarioInputs[]>(() => {
    if (selectedProject) return buildScenariosForProject(selectedProject);
    return [
      {
        name: "Baseline Plan",
        budgetCrore: 2500,
        stations: 14,
        corridorKm: 28,
        dailyRidership: 160000,
        constructionYears: 6.5,
        trainCapacityPerHour: 15000,
        energyKwhPerTrainKm: 19,
        sustainabilityPriorities: ["Low-carbon construction"],
      },
    ];
  });

  const [activeIdx, setActiveIdx] = useState(0);
  const [outputs, setOutputs] = useState(() => scenarios.map((s) => runScenario(s)));
  const [mc, setMc] = useState<MonteCarloResult | null>(null);
  const [mcBusy, setMcBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportCreated, setReportCreated] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // Alignment overlay toggles
  const [showRiskHeatmap, setShowRiskHeatmap] = useState(true);
  const [showTelemetry, setShowTelemetry] = useState(true);
  const [selectedStationNode, setSelectedStationNode] = useState<SimulatedStationNode | null>(null);

  // When project changes, refresh scenarios and outputs
  const [prevProjectKey, setPrevProjectKey] = useState<string | null>(selectedProject?.id ?? null);
  if (selectedProject && selectedProject.id !== prevProjectKey) {
    setPrevProjectKey(selectedProject.id);
    const newScenarios = buildScenariosForProject(selectedProject);
    setScenarios(newScenarios);
    setActiveIdx(0);
    setOutputs(newScenarios.map((s) => runScenario(s)));
    setMc(null);
    setDirty(false);
    setReportCreated(null);
    setReportError(null);
    setSelectedStationNode(null);
  }

  const errors = useMemo(() => validateInputs(scenarios[activeIdx]), [scenarios, activeIdx]);
  const out = outputs[activeIdx] ?? runScenario(scenarios[activeIdx]);
  const active = scenarios[activeIdx];

  const setParam = <K extends keyof ScenarioInputs>(key: K, value: ScenarioInputs[K]) => {
    setDirty(true);
    setScenarios((prev) => {
      const next = [...prev];
      next[activeIdx] = { ...next[activeIdx], [key]: value };
      return next;
    });
    setReportCreated(null);
    setReportError(null);
  };

  const runAll = () => {
    if (errors.length > 0) return;
    setOutputs(scenarios.map((s) => runScenario(s)));
    setMc(null);
    setDirty(false);
    recordSimRun(3);
  };

  const resetPresets = () => {
    if (!selectedProject) return;
    const fresh = buildScenariosForProject(selectedProject);
    setScenarios(fresh);
    setOutputs(fresh.map((s) => runScenario(s)));
    setMc(null);
    setDirty(false);
    setReportError(null);
  };

  const runMc = () => {
    setMcBusy(true);
    setTimeout(() => {
      setMc(runMonteCarlo(scenarios[activeIdx], 500, 4217));
      setMcBusy(false);
    }, 60);
  };

  const makeReport = async () => {
    if (!selectedProject) return;
    setReportBusy(true);
    setReportError(null);
    try {
      const triples = scenarios.map((inputs, i) => ({ inputs, outputs: outputs[i] }));
      const content = reportFromScenarios(selectedProject, triples);
      const report = await createReport({
        projectId: selectedProject.id,
        title: `${selectedProject.name} — Scenario Comparison`,
        reportType: "Scenario Comparison",
        status: "Draft",
        content,
      });
      setReportCreated(report.id);
      recordSimRun(0);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Failed to save scenario comparison report.");
    } finally {
      setReportBusy(false);
    }
  };

  // Generate simulated stations along corridor for alignment visualization
  const simulatedStations: SimulatedStationNode[] = useMemo(() => {
    if (!selectedProject) return [];
    const count = Math.min(24, Math.max(4, active.stations || 8));
    const totalKm = active.corridorKm || 20;

    return Array.from({ length: count }, (_, i) => {
      const chainage = (i / (count - 1)) * totalKm;
      const isTerminal = i === 0 || i === count - 1;
      const isInterchange = !isTerminal && (i === Math.floor(count / 2) || i === Math.floor(count / 4));
      const type = isTerminal ? "Terminal" : isInterchange ? "Interchange" : "Standard";

      // Simulated telemetry values derived from active scenario inputs
      const powerBase = isTerminal ? 1200 : isInterchange ? 950 : 680;
      const powerDrawKw = Math.round(powerBase * (active.energyKwhPerTrainKm / 19));
      const throughputPaxHr = Math.round((active.dailyRidership / count / 14) * (isInterchange ? 1.6 : isTerminal ? 1.2 : 0.9));
      const healthScore = Math.max(78, Math.min(99, 95 - (i % 5) * 3));
      const riskFactor =
        selectedProject.riskLevel === "High" && i % 3 === 0
          ? "High"
          : selectedProject.riskLevel === "Moderate" && i % 2 === 0
            ? "Moderate"
            : "Low";

      return {
        index: i + 1,
        name: isTerminal
          ? i === 0
            ? `${selectedProject.name} (West Terminal)`
            : `${selectedProject.name} (East Terminal)`
          : isInterchange
            ? `Interchange Hub ${i + 1}`
            : `Station ${i + 1}`,
        type,
        chainageKm: Number(chainage.toFixed(1)),
        powerDrawKw,
        throughputPaxHr,
        healthScore,
        riskFactor,
      };
    });
  }, [selectedProject, active.stations, active.corridorKm, active.dailyRidership, active.energyKwhPerTrainKm]);

  // Loading state
  if (loading && projects.length === 0) {
    return (
      <div className="card mx-auto max-w-[1400px]">
        <LoadingBlock label="Loading workspace projects and digital twin simulation…" />
      </div>
    );
  }

  // Empty state: no projects in workspace
  if (!selectedProject || projects.length === 0) {
    return (
      <div className="card mx-auto max-w-[1400px]">
        <PageHeader
          title="Digital Twin — Scenario Simulation"
          subtitle="Compare execution strategies with a documented, deterministic scenario engine."
        />
        <EmptyState
          icon={FolderOpen}
          title="No projects in this workspace"
          body="Digital Twin simulations evaluate real capital envelopes, station allocations, and corridor alignments. Create your first project to begin scenario analysis."
          action={
            <Link href="/projects?new=1" className="btn btn-primary btn-sm">
              Create project
            </Link>
          }
        />
      </div>
    );
  }

  const capexChart = [
    { name: "Civil works", value: out.capex.civil },
    { name: "Systems", value: out.capex.systems },
    { name: "Land", value: out.capex.land },
    { name: "Rolling stock", value: Math.round(out.capex.rollingStock) },
    { name: "Contingency", value: out.capex.contingency },
  ];

  const comparison = [
    {
      key: "capex",
      label: "Modeled capex",
      get: (o: typeof out) => o.capex.totalModeled,
      fmt: (v: number) => formatCrore(v, settings.currency),
    },
    {
      key: "duration",
      label: "Modeled duration (yrs)",
      get: (o: typeof out) => o.schedule.estimatedYears,
      fmt: (v: number) => `${v}`,
    },
    {
      key: "risk",
      label: "Risk score",
      get: (o: typeof out) => o.risk.score,
      fmt: (v: number) => `${v}/100`,
    },
    {
      key: "sustain",
      label: "Sustainability score",
      get: (o: typeof out) => o.sustainability.score,
      fmt: (v: number) => `${v}/100`,
    },
    {
      key: "energy",
      label: "Annual energy (GWh)",
      get: (o: typeof out) => o.resources.annualEnergyGwh,
      fmt: (v: number) => `${v}`,
    },
  ];

  const requestedMissingProject = Boolean(
    queryProjectId && !projects.some((p) => p.id === queryProjectId),
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Digital Twin — Scenario Simulation"
        subtitle="Compare execution strategies with a documented, deterministic scenario engine."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={makeReport}
              disabled={reportBusy}
            >
              {reportBusy ? (
                <Loader2 size={13.5} className="animate-spin" aria-hidden />
              ) : (
                <FileDown size={13.5} aria-hidden />
              )}
              {reportBusy ? "Saving…" : "Save comparison report"}
            </button>
          </div>
        }
      />

      {/* Project selector & active status strip */}
      <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="twin-project-select" className="text-[12px] font-medium text-muted">
            Target Project:
          </label>
          <select
            id="twin-project-select"
            className="select h-8 py-1 text-[12.5px]"
            value={selectedProject.id}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.id}) {p.archived ? "— [Archived]" : ""}
              </option>
            ))}
          </select>
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <StatusTag status={selectedProject.status} />
            <RiskTag level={selectedProject.riskLevel} />
            <span>· {selectedProject.region}</span>
            <span>· {selectedProject.infraType}</span>
          </span>
        </div>

        <div className="flex items-center gap-1 border-t border-line pt-2 sm:border-t-0 sm:pt-0">
          <button
            type="button"
            className={cx(
              "btn btn-sm",
              activeTab === "simulation" ? "btn-primary" : "btn-secondary",
            )}
            onClick={() => setActiveTab("simulation")}
          >
            <FlaskConical size={12} aria-hidden /> Simulation & Trade-offs
          </button>
          <button
            type="button"
            className={cx(
              "btn btn-sm",
              activeTab === "alignment" ? "btn-primary" : "btn-secondary",
            )}
            onClick={() => setActiveTab("alignment")}
          >
            <Activity size={12} aria-hidden /> Digital Twin Alignment
          </button>
        </div>
      </div>

      {/* Query project missing notice */}
      {requestedMissingProject && (
        <div
          className="mb-4 flex items-center justify-between gap-2 rounded-md border border-[#4A3B1E] bg-warning-soft px-4 py-2 text-[12px] text-warning"
          role="status"
        >
          <span>
            Requested project <span className="font-mono">{queryProjectId}</span> was not found in
            this workspace. Showing <span className="font-semibold">{selectedProject.name}</span>{" "}
            instead.
          </span>
        </div>
      )}

      {/* Archived banner */}
      {selectedProject.archived && (
        <div
          className="mb-4 flex items-center justify-between gap-2 rounded-md border border-line bg-app-bg px-4 py-2 text-[12px] text-muted"
          role="status"
        >
          <span>
            Project <span className="font-semibold text-ink">{selectedProject.name}</span> is
            archived. Simulation metrics reflect its archived parameters for historical review.
          </span>
        </div>
      )}

      {/* Report status notifications */}
      {reportCreated && (
        <div
          className="anim-pop mb-4 flex items-center justify-between gap-2 rounded-md border border-[#1F4A3C] bg-success-soft px-4 py-2.5 text-[12.5px] text-success"
          role="status"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 size={15} aria-hidden /> Scenario comparison saved as report{" "}
            <span className="font-mono font-semibold">{reportCreated}</span>.
          </span>
          <Link
            href={`/reports?open=${reportCreated}`}
            className="font-semibold underline underline-offset-2"
          >
            Open in Reports
          </Link>
        </div>
      )}

      {reportError && (
        <div
          className="mb-4 flex items-center justify-between gap-2 rounded-md border border-danger/40 bg-danger/10 px-4 py-2.5 text-[12px] text-danger"
          role="alert"
        >
          <span>{reportError}</span>
          <button
            type="button"
            className="text-danger underline hover:opacity-80"
            onClick={() => setReportError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: SCENARIO SIMULATION */}
      {activeTab === "simulation" && (
        <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
          {/* Configuration panel */}
          <section className="card h-fit xl:sticky xl:top-[72px]" aria-label="Scenario configuration">
            <div className="card-header flex items-center justify-between">
              <p className="card-title">Scenario controls</p>
              <span className="text-[10px] text-muted font-mono">{selectedProject.id}</span>
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
                      activeIdx === i
                        ? "bg-primary text-[#0A0B0D]"
                        : "bg-app-bg text-muted hover:text-ink",
                    )}
                  >
                    {s.name.replace(" Plan", "")}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3 p-4">
              <NumField
                k="budgetCrore"
                v={active.budgetCrore}
                onChange={(v) => setParam("budgetCrore", v)}
              />
              <NumField
                k="stations"
                v={active.stations}
                onChange={(v) => setParam("stations", v)}
              />
              <NumField
                k="corridorKm"
                v={active.corridorKm}
                onChange={(v) => setParam("corridorKm", v)}
              />
              <NumField
                k="dailyRidership"
                v={active.dailyRidership}
                onChange={(v) => setParam("dailyRidership", v)}
              />
              <NumField
                k="constructionYears"
                v={active.constructionYears}
                step={0.5}
                onChange={(v) => setParam("constructionYears", v)}
              />
              <NumField
                k="trainCapacityPerHour"
                v={active.trainCapacityPerHour}
                step={500}
                onChange={(v) => setParam("trainCapacityPerHour", v)}
              />
              <NumField
                k="energyKwhPerTrainKm"
                v={active.energyKwhPerTrainKm}
                onChange={(v) => setParam("energyKwhPerTrainKm", v)}
              />

              <fieldset>
                <legend className="label">Sustainability priorities</legend>
                <div className="flex flex-wrap gap-1.5">
                  {PRIO_OPTIONS.map((p) => {
                    const on = active.sustainabilityPriorities.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setParam(
                            "sustainabilityPriorities",
                            on
                              ? active.sustainabilityPriorities.filter((x) => x !== p)
                              : [...active.sustainabilityPriorities, p],
                          )
                        }
                        className={cx(
                          "rounded border px-2 py-1 text-[10.5px] transition-colors",
                          on
                            ? "border-[#3A404B] bg-primary-soft font-medium text-primary-hover"
                            : "border-line bg-surface text-muted hover:text-ink",
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {errors.length > 0 && (
                <div
                  className="rounded-md border border-[#4D2727] bg-critical-soft px-3 py-2"
                  role="alert"
                >
                  {errors.map((e) => (
                    <p
                      key={e}
                      className="flex items-start gap-1.5 text-[11px] leading-4.5 text-critical"
                    >
                      <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden /> {e}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  onClick={runAll}
                  disabled={errors.length > 0}
                >
                  <FlaskConical size={13.5} aria-hidden /> Run simulation
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={resetPresets}
                  title="Reset to project presets"
                >
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
              <Kpi
                label="Modeled capex"
                value={formatCrore(out.capex.totalModeled, settings.currency)}
                sub={`${out.capex.budgetUtilizationPct.toFixed(1)}% of envelope`}
                bad={!out.capex.withinBudget}
              />
              <Kpi
                label="Modeled duration"
                value={`${out.schedule.estimatedYears} yrs`}
                sub={
                  out.schedule.schedulePressurePct > 0
                    ? `${out.schedule.schedulePressurePct.toFixed(1)}% over target`
                    : "inside target"
                }
                bad={out.schedule.schedulePressurePct > 5}
              />
              <Kpi
                label="Demand coverage"
                value={`${out.demand.demandCoveragePct.toFixed(0)}%`}
                sub={`${formatNumber(out.demand.dailyCapacityOffered)} riders/day offered`}
              />
              <Kpi
                label="Peak crowding"
                value={`${out.demand.peakCrowdingIndex.toFixed(2)}×`}
                sub="practical capacity"
                bad={out.demand.peakCrowdingIndex > 1}
              />
              <Kpi
                label="Fleet"
                value={`${out.resources.fleetTrains}`}
                sub={`${out.resources.annualEnergyGwh} GWh/yr traction`}
              />
              <Kpi
                label="Staff estimate"
                value={formatNumber(out.resources.staffEstimate)}
                sub="operations FTE"
              />
              <div className="card px-4 py-3">
                <p className="text-[11px] font-medium text-muted">Composite risk</p>
                <p className="mt-1 text-[20px] font-semibold leading-tight text-ink">
                  {out.risk.score}
                  <span className="text-[12px] text-muted">/100</span>
                </p>
                <div className="mt-1">
                  <RiskTag level={out.risk.level} />
                </div>
              </div>
              <div className="card px-4 py-3">
                <p className="text-[11px] font-medium text-muted">Sustainability</p>
                <p className="mt-1 text-[20px] font-semibold leading-tight text-ink">
                  {out.sustainability.score}
                  <span className="text-[12px] text-muted">/100</span>
                </p>
                <p className="mt-1 text-[10.5px] text-faint">
                  {formatNumber(out.sustainability.co2AvoidedTonsPerYear)} t CO₂ avoided/yr
                </p>
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
                      <RTooltip
                        formatter={(v) => formatCrore(Number(v), settings.currency)}
                        contentStyle={{
                          fontSize: 11.5,
                          borderRadius: 6,
                          border: "1px solid #23262C",
                          backgroundColor: "#14171A",
                          color: "#ECEDEF",
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={16}>
                        {capexChart.map((d) => (
                          <Cell
                            key={d.name}
                            fill={d.name === "Contingency" ? "#D2A24C" : CHART_COLOR}
                          />
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
                      rows={scenarios.map((s, i) => ({
                        name: s.name.split(" ")[0],
                        value: c.get(outputs[i]),
                        active: i === activeIdx,
                      }))}
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
                        <th key={s.name} className={cx(i === activeIdx && "text-primary")}>
                          {s.name}
                        </th>
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
                            const delta =
                              i === 0
                                ? ""
                                : v === base
                                  ? " (±0)"
                                  : ` (${v > base ? "+" : ""}${
                                      typeof v === "number" && v % 1 !== 0
                                        ? (v - base).toFixed(1)
                                        : formatDelta(v - base)
                                    })`;
                            return (
                              <td
                                key={s.name}
                                className={cx(
                                  i === activeIdx && "bg-primary-soft/40 font-medium text-ink",
                                )}
                              >
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
                        <td key={i} className={cx(i === activeIdx && "bg-primary-soft/40")}>
                          <RiskTag level={o.risk.level} />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="border-t border-line px-4 py-3 text-[11.5px] leading-5 text-muted">
                <span className="font-medium text-ink-2">Trade-off reading:</span> cutting scope
                lowers capex and risk but reduces coverage and CO₂ benefit; the sustainability plan
                raises both sustainability score and capex. The baseline keeps envelope headroom
                above 8% while meeting demand coverage targets for {selectedProject.name}.
              </div>
            </section>

            {/* Monte Carlo */}
            <section className="card" aria-label="Uncertainty analysis">
              <div className="card-header">
                <div>
                  <p className="card-title">Uncertainty analysis — {active.name}</p>
                  <p className="card-sub mt-0.5">
                    Actual Monte Carlo trials over documented uncertainty ranges
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={runMc}
                  disabled={mcBusy}
                >
                  {mcBusy ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                  ) : (
                    <Sigma size={13} aria-hidden />
                  )}
                  {mc ? "Re-run (500 trials)" : "Run 500 trials"}
                </button>
              </div>
              {!mc ? (
                <div className="p-4 text-[12px] leading-5 text-muted">
                  Not run yet. This executes 500 real sampling trials with a fixed seed over the
                  active scenario’s cost and schedule parameters — deterministic results identical
                  across machines.
                </div>
              ) : (
                <div className="grid gap-4 p-4 lg:grid-cols-2">
                  <div>
                    <div className="grid grid-cols-3 gap-2">
                      <Percentile
                        label="P10 cost"
                        v={formatCrore(mc.costCrore.p10, settings.currency)}
                      />
                      <Percentile
                        label="P50 cost"
                        v={formatCrore(mc.costCrore.p50, settings.currency)}
                        highlight
                      />
                      <Percentile
                        label="P90 cost"
                        v={formatCrore(mc.costCrore.p90, settings.currency)}
                        warn
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <Percentile label="P10 duration" v={`${mc.durationYears.p10} yrs`} />
                      <Percentile
                        label="P50 duration"
                        v={`${mc.durationYears.p50} yrs`}
                        highlight
                      />
                      <Percentile label="P90 duration" v={`${mc.durationYears.p90} yrs`} warn />
                    </div>
                    <ul className="mt-3 space-y-1">
                      {mc.assumptions.map((a) => (
                        <li
                          key={a}
                          className="flex items-start gap-1.5 text-[10.5px] leading-4 text-muted"
                        >
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
                        <RTooltip
                          contentStyle={{
                            fontSize: 11.5,
                            borderRadius: 6,
                            border: "1px solid #23262C",
                            backgroundColor: "#14171A",
                            color: "#ECEDEF",
                          }}
                          formatter={(v) => [`${v} trials`, "Count"]}
                        />
                        <Bar dataKey="count" fill={CHART_COLOR} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </section>

            {/* Assumptions */}
            <section className="card" aria-label="Model assumptions">
              <div className="card-header">
                <p className="card-title">Documented model assumptions</p>
              </div>
              <div className="grid gap-x-8 gap-y-1.5 p-4 text-[11.5px] text-muted sm:grid-cols-2">
                <Assumption k="Civil works" v={`₹${MODEL_CONSTANTS.CIVIL_PER_KM} cr per route-km`} />
                <Assumption
                  k="Systems & signaling"
                  v={`₹${MODEL_CONSTANTS.SYSTEMS_PER_KM} cr per route-km`}
                />
                <Assumption
                  k="Land & integration"
                  v={`₹${MODEL_CONSTANTS.LAND_PER_STATION} cr per station`}
                />
                <Assumption
                  k="Rolling stock"
                  v={`₹${MODEL_CONSTANTS.ROLLING_STOCK_PER_TRAIN} cr per 4-car train`}
                />
                <Assumption
                  k="Contingency"
                  v={`${MODEL_CONSTANTS.CONTINGENCY_PCT * 100}% of direct costs`}
                />
                <Assumption
                  k="Construction throughput"
                  v={`${MODEL_CONSTANTS.KM_PER_YEAR} km/yr + ${MODEL_CONSTANTS.YEARS_PER_STATION} yr per station box`}
                />
                <Assumption
                  k="Capacity model"
                  v={`${MODEL_CONSTANTS.OPERATING_HOURS}h/day × practical factor ${MODEL_CONSTANTS.PRACTICAL_FACTOR}`}
                />
                <Assumption
                  k="Modal shift / CO₂"
                  v={`${MODEL_CONSTANTS.MODAL_SHIFT * 100}% shift · ${MODEL_CONSTANTS.CO2_PER_ROAD_PAX_KM} kg/pax-km`}
                />
              </div>
              <div className="border-t border-line px-4 py-3 text-[10.5px] leading-4.5 text-faint">
                Demonstrative heuristics for reproducible demo output — not a physically accurate
                digital-twin simulation and not a validated Monte Carlo forecast.
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB 2: CORRIDOR ALIGNMENT & DIGITAL TWIN TELEMETRY */}
      {activeTab === "alignment" && (
        <div className="space-y-4">
          {/* Top metadata strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-3.5">
              <p className="text-[11px] text-muted">Corridor length</p>
              <p className="mt-1 text-[18px] font-semibold text-ink">{active.corridorKm} km</p>
              <p className="text-[10.5px] text-faint">Saved alignment route</p>
            </div>
            <div className="card p-3.5">
              <p className="text-[11px] text-muted">Station allocations</p>
              <p className="mt-1 text-[18px] font-semibold text-ink">{active.stations}</p>
              <p className="text-[10.5px] text-faint">Allocated station boxes</p>
            </div>
            <div className="card p-3.5">
              <p className="text-[11px] text-muted">Estimated traction power</p>
              <p className="mt-1 text-[18px] font-semibold text-ink">
                {out.resources.annualEnergyGwh} GWh/yr
              </p>
              <p className="text-[10.5px] text-faint">Traction substation feed</p>
            </div>
            <div className="card p-3.5">
              <p className="text-[11px] text-muted">Network risk factor</p>
              <div className="mt-1 flex items-center gap-2">
                <RiskTag level={selectedProject.riskLevel} />
                <span className="text-[12px] font-semibold text-ink">{out.risk.score}/100</span>
              </div>
              <p className="text-[10.5px] text-faint">Terrain & construction overlay</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            {/* Visual alignment canvas */}
            <section className="card flex flex-col overflow-hidden" aria-label="Digital twin alignment schematic">
              <div className="card-header flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="card-title">Corridor schematic & simulated telemetry</p>
                  <p className="card-sub">
                    2D vector schematic derived from {selectedProject.name} parameters
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
                    <input
                      type="checkbox"
                      className="h-3 w-3 accent-[#F2F3F5]"
                      checked={showRiskHeatmap}
                      onChange={(e) => setShowRiskHeatmap(e.target.checked)}
                    />
                    <Layers size={11} aria-hidden /> Risk Heatmap
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
                    <input
                      type="checkbox"
                      className="h-3 w-3 accent-[#F2F3F5]"
                      checked={showTelemetry}
                      onChange={(e) => setShowTelemetry(e.target.checked)}
                    />
                    <Radio size={11} aria-hidden /> Telemetry
                  </label>
                </div>
              </div>

              {/* Vector Corridor Canvas */}
              <div className="min-h-[380px] flex-1 bg-[#0A0B0D] p-6 flex flex-col justify-between overflow-x-auto">
                <div className="flex items-center justify-between border-b border-line/40 pb-3 text-[11px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-primary" /> {selectedProject.name} Alignment
                  </span>
                  <span className="font-mono text-faint">
                    Chainage: 0.0 km — {active.corridorKm}.0 km
                  </span>
                </div>

                {/* SVG Route diagram */}
                <div className="my-8 relative flex items-center justify-between px-4">
                  {/* Guideway background track */}
                  <div
                    className={cx(
                      "absolute left-4 right-4 h-2.5 rounded-full transition-colors",
                      showRiskHeatmap
                        ? selectedProject.riskLevel === "High"
                          ? "bg-gradient-to-r from-success via-warning to-danger opacity-80"
                          : selectedProject.riskLevel === "Moderate"
                            ? "bg-gradient-to-r from-success via-warning to-success opacity-80"
                            : "bg-gradient-to-r from-success to-primary opacity-80"
                        : "bg-surface-2 border border-line",
                    )}
                  />

                  {/* Station nodes */}
                  {simulatedStations.map((node) => {
                    const isSelected = selectedStationNode?.index === node.index;
                    const ringColor =
                      node.riskFactor === "High"
                        ? "border-danger bg-danger/20"
                        : node.riskFactor === "Moderate"
                          ? "border-warning bg-warning/20"
                          : "border-primary bg-primary/20";

                    return (
                      <button
                        key={node.index}
                        type="button"
                        onClick={() => setSelectedStationNode(node)}
                        className="group relative z-10 flex flex-col items-center transition-transform hover:scale-110 focus:outline-none"
                        title={`${node.name} (${node.chainageKm} km)`}
                      >
                        <span
                          className={cx(
                            "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all",
                            isSelected
                              ? "scale-125 border-primary bg-primary text-[#0A0B0D] shadow-lg shadow-primary/20"
                              : showRiskHeatmap
                                ? `${ringColor} text-ink`
                                : "border-line bg-surface text-muted group-hover:border-primary group-hover:text-ink",
                          )}
                        >
                          {node.index}
                        </span>

                        <span
                          className={cx(
                            "absolute top-8 whitespace-nowrap text-[10px] transition-colors max-w-[80px] truncate text-center",
                            isSelected
                              ? "font-semibold text-primary"
                              : "text-muted group-hover:text-ink",
                          )}
                        >
                          {node.chainageKm}k
                        </span>

                        {showTelemetry && (
                          <span className="absolute -top-6 flex items-center gap-0.5 text-[9px] text-faint font-mono">
                            <Zap size={8} className="text-warning" />
                            {node.powerDrawKw}kW
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/40 pt-3 text-[10.5px] text-faint">
                  <span>Click any station node along the route to inspect its simulated telemetry and sub-system status.</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-success" /> Low risk
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-warning" /> Moderate risk
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-danger" /> Elevated risk
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Station Inspection Panel */}
            <aside className="card flex flex-col" aria-label="Station telemetry inspection">
              <div className="card-header flex items-center justify-between">
                <p className="card-title flex items-center gap-1.5">
                  <Cpu size={13} aria-hidden /> Subsystem Telemetry
                </p>
                <span className="text-[10px] text-muted">Simulated</span>
              </div>

              {!selectedStationNode ? (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted">
                  <Activity size={24} className="mb-2 text-faint" aria-hidden />
                  <p className="text-[13px] font-medium text-ink">Select a station</p>
                  <p className="mt-1 text-[11px] leading-5 text-muted">
                    Click any node on the corridor schematic to inspect its simulated power,
                    throughput, and structural health.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 p-4 text-[12px]">
                  <div className="border-b border-line pb-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[14px] font-semibold text-ink">
                        {selectedStationNode.name}
                      </p>
                      <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        Node #{selectedStationNode.index}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">
                      Chainage: {selectedStationNode.chainageKm} km · Type:{" "}
                      {selectedStationNode.type}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex justify-between border-b border-line pb-1.5">
                      <span className="text-muted">Throughput demand:</span>
                      <span className="font-medium text-ink">
                        ~{formatNumber(selectedStationNode.throughputPaxHr)} pax/hr
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-line pb-1.5">
                      <span className="text-muted">Substation power draw:</span>
                      <span className="font-mono font-medium text-ink">
                        {selectedStationNode.powerDrawKw} kW (25kV AC)
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-line pb-1.5">
                      <span className="text-muted">Structural condition:</span>
                      <span className="font-semibold text-success">
                        {selectedStationNode.healthScore}/100 (Optimal)
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-line pb-1.5">
                      <span className="text-muted">Segment risk rating:</span>
                      <span>
                        <RiskTag level={selectedStationNode.riskFactor} />
                      </span>
                    </div>
                  </div>

                  <div className="rounded-md border border-line bg-app-bg p-3 text-[11px] leading-4.5 text-faint">
                    <span className="font-medium text-muted">Digital Twin Advisory:</span> Telemetry
                    metrics are calculated deterministically from {selectedProject.name}&apos;s saved
                    envelope (length {active.corridorKm} km, {active.stations} stations) — not from
                    live physical IoT field sensors.
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DigitalTwinPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading Digital Twin simulation…" />}>
      <DigitalTwinInner />
    </Suspense>
  );
}

function NumField({
  k,
  v,
  onChange,
  step,
}: {
  k: keyof typeof INPUT_BOUNDS;
  v: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  const b = INPUT_BOUNDS[k];
  return (
    <div>
      <label className="label" htmlFor={`f-${k}`}>
        {b.label}
      </label>
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

function Kpi({
  label,
  value,
  sub,
  bad,
}: {
  label: string;
  value: string;
  sub: string;
  bad?: boolean;
}) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p
        className={cx(
          "mt-1 text-[20px] font-semibold leading-tight",
          bad ? "text-critical" : "text-ink",
        )}
      >
        {value}
      </p>
      <p className={cx("mt-0.5 text-[10.5px]", bad ? "text-critical" : "text-faint")}>{sub}</p>
    </div>
  );
}

function MiniCompare({
  label,
  rows,
  fmt,
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
            <RTooltip
              formatter={(v) => fmt(Number(v))}
              contentStyle={{
                fontSize: 11,
                borderRadius: 6,
                border: "1px solid #23262C",
                backgroundColor: "#14171A",
                color: "#ECEDEF",
              }}
              cursor={{ fill: "rgba(53,92,125,0.06)" }}
            />
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

function Percentile({
  label,
  v,
  highlight,
  warn,
}: {
  label: string;
  v: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-md border px-3 py-2",
        highlight
          ? "border-[#3A404B] bg-primary-soft/50"
          : warn
            ? "border-[#4A3B1E] bg-warning-soft/60"
            : "border-line bg-app-bg",
      )}
    >
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
