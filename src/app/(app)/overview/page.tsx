"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity as ActivityIcon,
  ArrowRight,
  ArrowUpRight,
  FilePlus2,
  FlaskConical,
  FolderKanban,
  Landmark,
  ShieldAlert,
  TrainFront,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { useApp } from "@/components/providers/AppProvider";
import { NetworkSchematic } from "@/components/home/NetworkSchematic";
import { DemoBanner, PageHeader, RiskTag, StatusTag } from "@/components/ui";
import { DEMO_BANNER, SEED_ACTIVITIES } from "@/lib/data/seed";
import { buildScenarioInputs } from "@/lib/demo-analysis";
import { DEFAULT_SCENARIOS, runScenario } from "@/lib/simulation";
import { cx, formatCrore, formatNumber, timeAgo } from "@/lib/format";
import type { Corridor, RiskLevel, Station } from "@/lib/types";

const PIE_COLORS = ["#F2F3F5", "#9AA1AC", "#3FA97F", "#565E68", "#D2A24C"];

const RISK_BAR_COLORS: Record<RiskLevel, string> = {
  Low: "#3FA97F",
  Moderate: "#F2F3F5",
  High: "#D2A24C",
  Critical: "#D76060",
};

const TIMELINE = [
  { phase: "Enabling works & utility diversions", start: 0, end: 14, color: "#9AA1AC" },
  { phase: "Civil pkg 1 — elevated sections", start: 10, end: 38, color: "#F2F3F5" },
  { phase: "Civil pkg 2 — station boxes", start: 16, end: 46, color: "#6E7781" },
  { phase: "Systems & rolling stock", start: 40, end: 66, color: "#3FA97F" },
  { phase: "Testing & commissioning", start: 60, end: 72, color: "#D2A24C" },
  { phase: "Opening & ramp-up", start: 72, end: 84, color: "#565E68" },
];

const ACT_ICONS = {
  project: FolderKanban,
  simulation: FlaskConical,
  analysis: ActivityIcon,
  report: FilePlus2,
  geo: TrainFront,
} as const;

export default function CommandCenter() {
  const router = useRouter();
  const { projects, activeProjects, featuredProject, settings, simRunCount } = useApp();
  const [schematicSel, setSchematicSel] = useState<
    { kind: "station"; station: Station } | { kind: "corridor"; corridor: Corridor } | null
  >(null);

  const featuredOutputs = useMemo(
    () => (featuredProject ? runScenario(buildScenarioInputs(featuredProject)) : null),
    [featuredProject],
  );

  const metrics = useMemo(() => {
    const active = activeProjects;
    const investment = active.reduce((s, p) => s + p.budgetCrore, 0);
    const highRisks = active.filter((p) => p.riskLevel === "High" || p.riskLevel === "Critical").length;
    return { active: active.length, investment, highRisks, simulations: simRunCount };
  }, [activeProjects, simRunCount]);

  const riskSummary = useMemo(() => {
    const levels: RiskLevel[] = ["Low", "Moderate", "High", "Critical"];
    return levels.map((lv) => ({
      level: lv,
      count: activeProjects.filter((p) => p.riskLevel === lv).length,
    }));
  }, [activeProjects]);

  const scenarioComparison = useMemo(
    () =>
      DEFAULT_SCENARIOS.map((inputs) => {
        const outputs = runScenario(inputs);
        return { name: inputs.name, outputs };
      }),
    [],
  );
  const recommended = scenarioComparison[0]; // Baseline is the recommended starting point

  const budgetData = useMemo(() => {
    if (!featuredOutputs) return [];
    const c = featuredOutputs.capex;
    return [
      { name: "Civil works", value: c.civil },
      { name: "Systems & signaling", value: c.systems },
      { name: "Land & integration", value: c.land },
      { name: "Rolling stock", value: Math.round(c.rollingStock) },
      { name: "Contingency", value: c.contingency },
    ];
  }, [featuredOutputs]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Infrastructure Command Center"
        subtitle="Plan, evaluate, and optimize complex infrastructure decisions."
        actions={
          <>
            <Link href="/projects?new=1" className="btn btn-primary">
              <FilePlus2 size={14} aria-hidden /> New Project
            </Link>
            <Link
              href={featuredProject ? `/twin?project=${featuredProject.id}` : "/twin"}
              className="btn btn-secondary"
            >
              <FlaskConical size={14} aria-hidden /> Run Simulation
            </Link>
          </>
        }
      />

      {/* Featured project */}
      {featuredProject && (
        <section className="card mb-4 overflow-hidden" aria-label="Featured project">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="mt-0.5 hidden rounded-md bg-primary-soft p-2.5 text-primary sm:block">
                <TrainFront size={20} aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[17px] font-semibold text-ink">{featuredProject.name}</h2>
                  <StatusTag status={featuredProject.status} />
                  <button
                    type="button"
                    onClick={() => router.push(`/projects/${featuredProject.id}`)}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary-hover"
                  >
                    Open project <ArrowUpRight size={12} aria-hidden />
                  </button>
                </div>
                <p className="mt-1 max-w-2xl text-[12.5px] leading-5 text-muted">{featuredProject.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-3 sm:grid-cols-4">
              <FeatureStat
                label="Proposed stations"
                value={featuredProject.stations ? String(featuredProject.stations) : "—"}
              />
              <FeatureStat
                label="Planned corridor"
                value={featuredProject.corridorKm ? `${featuredProject.corridorKm} km` : "—"}
              />
              <FeatureStat label="Capital investment" value={formatCrore(featuredProject.budgetCrore, settings.currency)} />
              <FeatureStat label="Target completion" value={featuredProject.targetCompletion} />
            </div>
          </div>
          <div className="border-t border-line bg-app-bg px-5 py-2">
            <DemoBanner text={DEMO_BANNER} />
          </div>
        </section>
      )}

      {/* Portfolio metrics */}
      <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Portfolio metrics">
        <MetricTile label="Active projects" value={String(metrics.active)} sub={`${projects.length} total in register`} />
        <MetricTile label="Estimated portfolio investment" value={formatCrore(metrics.investment, settings.currency)} sub="Sum of active project envelopes" />
        <MetricTile label="Open high-priority risks" value={String(metrics.highRisks)} sub="Projects rated High or Critical" tone={metrics.highRisks > 2 ? "warn" : "ok"} />
        <MetricTile label="Completed simulations" value={String(metrics.simulations)} sub="3 calibrated presets + session runs" />
      </section>

      {/* Schematic + inspector + recommendation */}
      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <section className="card xl:col-span-2" aria-label="Metro network schematic">
          <div className="card-header">
            <div>
              <p className="card-title">Metro network schematic</p>
              <p className="card-sub mt-0.5">Metro Intelligence · two proposed corridors</p>
            </div>
            <span className="tag tag-neutral">Schematic — not to scale</span>
          </div>
          <div className="grid gap-0 lg:grid-cols-[1fr_250px]">
            <div className="p-4">
              <NetworkSchematic
                onSelect={(s) =>
                  setSchematicSel(
                    s.kind === "station" && s.station
                      ? { kind: "station", station: s.station }
                      : s.kind === "corridor" && s.corridor
                        ? { kind: "corridor", corridor: s.corridor }
                        : null,
                  )
                }
              />
            </div>
            <div className="border-t border-line bg-[#15181B] p-4 lg:border-l lg:border-t-0">
              {!schematicSel ? (
                <>
                  <p className="text-[12px] font-semibold text-ink">Inspector</p>
                  <p className="mt-2 text-[11.5px] leading-5 text-muted">
                    Select a station or corridor on the schematic to see catchment, ridership and alignment details here.
                  </p>
                  <div className="mt-4 space-y-1.5 border-t border-line pt-3">
                    <InspectorRow k="Key stations shown" v="16 of 42" />
                    <InspectorRow k="Interchanges" v="3" />
                    <InspectorRow k="Lines" v="2" />
                    <InspectorRow k="Programme corridor" v="68 km" />
                  </div>
                </>
              ) : schematicSel.kind === "station" ? (
                <div className="anim-fade">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">Station</p>
                  <p className="mt-1 text-[13.5px] font-semibold text-ink">{schematicSel.station.name}</p>
                  <div className="mt-3 space-y-1.5">
                    <InspectorRow k="Code" v={schematicSel.station.code} />
                    <InspectorRow k="Line" v={schematicSel.station.line === "Both" ? "Lines A & B" : schematicSel.station.line} />
                    <InspectorRow k="Type" v={schematicSel.station.type} />
                    <InspectorRow k="Daily ridership" v={`~${formatNumber(schematicSel.station.dailyRidership)}`} />
                  </div>
                  <p className="mt-3 border-t border-line pt-3 text-[11.5px] leading-5 text-muted">
                    {schematicSel.station.catchment}
                  </p>
                  <Link href="/geo" className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium text-primary hover:text-primary-hover">
                    Open in Geo Intelligence <ArrowRight size={11} aria-hidden />
                  </Link>
                </div>
              ) : (
                <div className="anim-fade">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">Corridor</p>
                  <p className="mt-1 text-[13.5px] font-semibold text-ink">{schematicSel.corridor.name}</p>
                  <div className="mt-3 space-y-1.5">
                    <InspectorRow k="Length" v={`${schematicSel.corridor.lengthKm} km`} />
                    <InspectorRow k="Key stations" v={String(schematicSel.corridor.points.length)} />
                    <InspectorRow k="Status" v={schematicSel.corridor.status} />
                  </div>
                  <p className="mt-3 border-t border-line pt-3 text-[11.5px] leading-5 text-muted">
                    {schematicSel.corridor.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Scenario recommendation */}
        <section className="card flex flex-col" aria-label="Scenario recommendation">
          <div className="card-header">
            <div>
              <p className="card-title">Scenario recommendation</p>
              <p className="card-sub mt-0.5">Deterministic engine · 3 presets compared</p>
            </div>
          </div>
          <div className="flex-1 space-y-3 p-4">
            {scenarioComparison.map((s) => (
              <div
                key={s.name}
                className={cx(
                  "rounded-md border p-3",
                  s.name === recommended.name ? "border-[#3A404B] bg-primary-soft/50" : "border-line",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-ink">{s.name}</p>
                  {s.name === recommended.name && <span className="tag tag-primary">Recommended</span>}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                  <span>Capex {formatCrore(s.outputs.capex.totalModeled, settings.currency)}</span>
                  <span className="flex items-center gap-1.5">
                    Risk
                    <span className="inline-flex h-1.5 w-14 overflow-hidden rounded-full bg-line">
                      <span
                        className="block h-full"
                        style={{
                          width: `${s.outputs.risk.score}%`,
                          background: s.outputs.risk.score > 60 ? "#D76060" : s.outputs.risk.score > 40 ? "#D2A24C" : "#3FA97F",
                        }}
                      />
                    </span
                    >
                    {s.outputs.risk.score}
                  </span>
                </div>
              </div>
            ))}
            <p className="text-[11px] leading-4.5 text-muted">
              Recommended because it preserves envelope headroom ({recommended.outputs.capex.budgetUtilizationPct.toFixed(0)}% utilization),
              stays inside planning tolerances, and keeps the 2032 target credible. Verify against your constraints in the Twin.
            </p>
          </div>
          <div className="border-t border-line p-4">
            <Link href="/twin" className="btn btn-primary w-full">
              Compare in Digital Twin <ArrowRight size={13} aria-hidden />
            </Link>
          </div>
        </section>
      </div>

      {/* Bottom row */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Budget allocation */}
        <section className="card" aria-label="Budget allocation">
          <div className="card-header">
            <div>
              <p className="card-title">Budget allocation</p>
              <p className="card-sub mt-0.5">Modeled capex split · Metro Intelligence</p>
            </div>
          </div>
          <div className="p-4">
            <div className="h-[168px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={budgetData} dataKey="value" innerRadius={52} outerRadius={76} paddingAngle={2} strokeWidth={1} stroke="#121417">
                    {budgetData.map((d, i) => (
                      <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip
                    formatter={(v) => formatCrore(Number(v), settings.currency)}
                    contentStyle={{ fontSize: 11.5, borderRadius: 6, border: "1px solid #23262C", backgroundColor: "#14171A", color: "#ECEDEF" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-1 space-y-1.5">
              {budgetData.map((d, i) => (
                <li key={d.name} className="flex items-center gap-2 text-[11.5px]">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} aria-hidden />
                  <span className="flex-1 text-ink-2">{d.name}</span>
                  <span className="font-medium text-ink">{formatCrore(d.value, settings.currency)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Risk summary */}
        <section className="card" aria-label="Portfolio risk summary">
          <div className="card-header">
            <div>
              <p className="card-title">Portfolio risk summary</p>
              <p className="card-sub mt-0.5">Register risk ratings · active projects</p>
            </div>
          </div>
          <div className="space-y-2.5 p-4">
            {riskSummary.map((r) => (
              <div key={r.level} className="flex items-center gap-3">
                <span className="w-16 text-[11.5px] font-medium text-ink-2">{r.level}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-app-bg">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(r.count / Math.max(1, activeProjects.length)) * 100}%`, background: RISK_BAR_COLORS[r.level] }}
                  />
                </div>
                <span className="w-6 text-right text-[11.5px] font-semibold text-ink">{r.count}</span>
              </div>
            ))}
            <div className="mt-3 border-t border-line pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Featured risk drivers
              </p>
              {featuredOutputs?.risk.drivers.map((d) => (
                <p key={d} className="mb-1.5 flex items-start gap-2 text-[11.5px] leading-4.5 text-muted">
                  <ShieldAlert size={12} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                  {d}
                </p>
              ))}
              {featuredProject && (
                <div className="mt-2 flex items-center justify-between">
                  <RiskTag level={featuredOutputs?.risk.level ?? featuredProject.riskLevel} />
                  <Link href="/graph" className="text-[11.5px] font-medium text-primary hover:text-primary-hover">
                    Trace in graph
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Delivery timeline */}
        <section className="card" aria-label="Delivery timeline">
          <div className="card-header">
            <div>
              <p className="card-title">Delivery timeline</p>
              <p className="card-sub mt-0.5">Metro Intelligence · indicative 84-month programme</p>
            </div>
          </div>
          <div className="p-4">
            <div className="relative">
              <div className="mb-1.5 flex justify-between text-[9.5px] text-faint">
                {[0, 12, 24, 36, 48, 60, 72, 84].map((m) => (
                  <span key={m}>{m === 0 ? "Start" : `M${m}`}</span>
                ))}
              </div>
              <div className="space-y-2">
                {TIMELINE.map((t) => (
                  <div key={t.phase}>
                    <p className="mb-0.5 truncate text-[10.5px] text-muted">{t.phase}</p>
                    <div className="relative h-3 rounded-sm bg-app-bg">
                      <div
                        className="absolute top-0 h-full rounded-sm"
                        style={{ left: `${(t.start / 84) * 100}%`, width: `${((t.end - t.start) / 84) * 100}%`, background: t.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-[11px] text-muted">
              <Landmark size={12} className="text-faint" aria-hidden />
              Programme windows derive from the scenario engine schedule heuristics.
            </div>
          </div>
        </section>
      </div>

      {/* Activity */}
      <section className="card mt-4" aria-label="Recent activity">
        <div className="card-header">
          <div>
            <p className="card-title">Recent activity</p>
            <p className="card-sub mt-0.5">Workspace audit trail (demo events)</p>
          </div>
        </div>
        <div className="grid gap-0 p-2 sm:grid-cols-2 xl:grid-cols-3">
          {SEED_ACTIVITIES.slice(0, 6).map((a) => {
            const Icon = ACT_ICONS[a.kind];
            return (
              <div key={a.id} className="flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-app-bg">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded border border-line bg-surface text-muted">
                  <Icon size={13} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] leading-4.5 text-ink-2">
                    <span className="font-medium text-ink">{a.actor}</span> {a.action}{" "}
                    <span className="font-medium text-ink">{a.target}</span>
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-faint">{timeAgo(a.time)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function FeatureStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[18px] font-semibold leading-tight tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-[10.5px] text-muted">{label}</p>
    </div>
  );
}

function MetricTile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "ok" | "warn" }) {
  return (
    <div className="card px-4 py-3.5">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className={cx("mt-1 text-[22px] font-semibold leading-tight tracking-tight", tone === "warn" ? "text-warning" : tone === "ok" ? "text-success" : "text-ink")}>
        {value}
      </p>
      <p className="mt-0.5 text-[10.5px] text-faint">{sub}</p>
    </div>
  );
}

function InspectorRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11.5px]">
      <span className="text-muted">{k}</span>
      <span className="font-medium text-ink">{v}</span>
    </div>
  );
}
