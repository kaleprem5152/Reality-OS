"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  FileDown,
  Loader2,
  Play,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { EmptyState, PageHeader, StatusTag, RiskTag } from "@/components/ui";
import { api } from "@/lib/api-client";
import { buildDemoAnalysis } from "@/lib/demo-analysis";
import { reportFromAnalysis } from "@/lib/report-builder";
import { cx, formatCrore, formatNumber } from "@/lib/format";
import type { AgentFinding, AnalysisResult } from "@/lib/types";

const OBJECTIVE_OPTIONS = [
  "Optimize accessibility",
  "Control capital cost",
  "Minimize construction time",
  "Reduce environmental impact",
  "Integrate with existing transport",
];

export default function StudioPage() {
  const { activeProjects, settings, studioHandoff, clearStudioHandoff, createReport } = useApp();

  const featured = activeProjects.find((p) => p.featured) ?? activeProjects[0] ?? null;
  const [projectId, setProjectId] = useState<string>(featured?.id ?? "");
  const [requirements, setRequirements] = useState("");
  const [objectives, setObjectives] = useState<string[]>(["Optimize accessibility", "Control capital cost"]);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [openAgents, setOpenAgents] = useState<number[]>([0, 1]);

  const project = useMemo(
    () => activeProjects.find((p) => p.id === projectId) ?? null,
    [activeProjects, projectId],
  );

  // Load AI integration status (honest: live vs demo)
  useEffect(() => {
    let alive = true;
    api.aiStatus().then(
      (s) => alive && setAiConfigured(s.configured),
      () => alive && setAiConfigured(false),
    );
    return () => {
      alive = false;
    };
  }, []);

  // Prefill requirements when project changes
  const [prevProjectId, setPrevProjectId] = useState<string | null>(projectId);
  if (projectId !== prevProjectId) {
    setPrevProjectId(projectId);
    if (project) {
      setRequirements(project.requirements || `Plan and evaluate ${project.name} in ${project.region}.`);
    }
  }

  // Handoff from other pages ("Run planning analysis")
  const [prevHandoff, setPrevHandoff] = useState(studioHandoff);
  if (studioHandoff && studioHandoff !== prevHandoff) {
    setPrevHandoff(studioHandoff);
    setProjectId(studioHandoff.projectId);
    setRequirements(studioHandoff.requirements);
    if (studioHandoff.objectives.length) setObjectives(studioHandoff.objectives);
  }

  useEffect(() => {
    if (studioHandoff) {
      clearStudioHandoff();
    }
  }, [studioHandoff, clearStudioHandoff]);

  const run = async () => {
    if (!project || requirements.trim().length < 20) {
      setNotice("Enter a requirements brief of at least 20 characters before running the analysis.");
      return;
    }
    setRunning(true);
    setNotice(null);
    setSaveError(null);
    setSavedReportId(null);
    setResult(null);

    if (aiConfigured) {
      try {
        const { analysis } = await api.aiAnalyze({
          projectId: project.id,
          projectName: project.name,
          infraType: project.infraType,
          region: project.region,
          budgetCrore: project.budgetCrore,
          requirements,
          objectives,
          sustainabilityPriorities: project.sustainabilityPriorities,
        });
        setResult({
          mode: "live",
          projectId: project.id,
          projectName: project.name,
          generatedAt: new Date().toISOString(),
          ...(analysis as Omit<AnalysisResult, "mode" | "projectId" | "projectName" | "generatedAt">),
        });
        setRunning(false);
        return;
      } catch (e) {
        // Live path failed — fall back with a clear notice, never silently.
        setNotice(`Live AI request failed (${e instanceof Error ? e.message : "unknown error"}). Showing deterministic demo analysis instead.`);
      }
    }

    // Deterministic demo analysis path
    await new Promise((r) => setTimeout(r, 450)); // allow UI state to paint
    const demo = buildDemoAnalysis(project, requirements, objectives);
    setResult(demo);
    setRunning(false);
  };

  const saveReport = async () => {
    if (!result || saveBusy) return;
    setSaveBusy(true);
    setSaveError(null);
    try {
      const report = await createReport({
        projectId: result.projectId,
        title: `${result.projectName} — Planning Analysis`,
        reportType: "Planning Analysis",
        status: "Draft",
        content: reportFromAnalysis(result),
      });
      setSavedReportId(report.id);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save report.");
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="AI Planning Studio"
        subtitle="Transform infrastructure requirements into an explainable, structured planning report."
      />

      {/* Integration status banner */}
      <div
        className={cx(
          "mb-4 flex items-start gap-2.5 rounded-md border px-4 py-2.5 text-[12px] leading-5",
          aiConfigured
            ? "border-[#1F4A3C] bg-success-soft text-success"
            : "border-[#4A3B1E] bg-warning-soft text-warning",
        )}
        role="status"
      >
        <Bot size={15} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          {aiConfigured === null
            ? "Checking AI integration status…"
            : aiConfigured
              ? "Live AI mode — analysis requests are executed server-side via the configured Gemini integration. Outputs are validated before display and are advisory, not certified engineering advice."
              : "Demo analysis mode — no Gemini API key is configured on the server. Results below come from the documented deterministic engine, clearly labeled as demo analysis, never as live AI output."}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        {/* Input panel */}
        <section className="card h-fit xl:sticky xl:top-[72px]" aria-label="Analysis input">
          <div className="card-header"><p className="card-title">Planning brief</p></div>
          <div className="space-y-4 p-4">
            <div>
              <label className="label" htmlFor="s-project">Project</label>
              <select id="s-project" className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="s-req">Requirements brief</label>
              <textarea
                id="s-req"
                className="textarea"
                style={{ minHeight: 128 }}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="Describe what should be planned, constraints, and priorities…"
              />
              <p className="mt-1 text-[10px] text-faint">{requirements.trim().length} characters (minimum 20)</p>
            </div>
            <fieldset>
              <legend className="label">Planning objectives</legend>
              <div className="space-y-1.5">
                {OBJECTIVE_OPTIONS.map((o) => (
                  <label key={o} className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-2">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-[#F2F3F5]"
                      checked={objectives.includes(o)}
                      onChange={(e) =>
                        setObjectives(e.target.checked ? [...objectives, o] : objectives.filter((x) => x !== o))
                      }
                    />
                    {o}
                  </label>
                ))}
              </div>
            </fieldset>
            {project && (
              <div className="rounded-md border border-line bg-app-bg px-3 py-2.5 text-[11px] leading-5 text-muted">
                <p><span className="font-medium text-ink-2">Budget constraint:</span> {formatCrore(project.budgetCrore, settings.currency)} envelope</p>
                <p className="mt-0.5">
                  <span className="font-medium text-ink-2">Sustainability priorities:</span>{" "}
                  {project.sustainabilityPriorities.join(", ") || "none recorded"}
                </p>
              </div>
            )}
            <button type="button" className="btn btn-primary w-full" onClick={run} disabled={running || !project}>
              {running ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Play size={13.5} aria-hidden />}
              {running ? (aiConfigured ? "Requesting Gemini analysis…" : "Computing demo analysis…") : "Run analysis"}
            </button>
            {notice && (
              <div className="flex items-start gap-2 rounded-md border border-[#4A3B1E] bg-warning-soft px-3 py-2 text-[11.5px] leading-4.5 text-warning" role="alert">
                <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden /> {notice}
              </div>
            )}
          </div>
        </section>

        {/* Results document */}
        <section aria-label="Analysis results" className="min-w-0">
          {running && (
            <div className="card flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 size={22} className="animate-spin text-primary" aria-hidden />
              <p className="text-[13px] font-medium text-ink">
                {aiConfigured ? "Executing server-side Gemini request…" : "Running deterministic planning engine…"}
              </p>
              <p className="text-[11.5px] text-muted">Coordinating five planning agents on the requirements brief.</p>
            </div>
          )}

          {!running && !result && (
            <div className="card">
              <EmptyState
                icon={BrainCircuit}
                title="No analysis yet"
                body="Select a project, refine the requirements brief, and run the analysis. Five planning agents — transportation, financial, environmental, utilities, and risk — return structured, explainable findings."
              />
            </div>
          )}

          {!running && result && (
            <div className="space-y-4">
              {/* Report head */}
              <div className="card">
                <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[17px] font-semibold text-ink">Planning analysis — {result.projectName}</h2>
                      {result.mode === "demo" ? (
                        <span className="tag tag-warning">Demo analysis — deterministic engine</span>
                      ) : (
                        <span className="tag tag-success">Live Gemini analysis</span>
                      )}
                    </div>
                    <p className="mt-1 text-[11.5px] text-muted">
                      Generated {new Date(result.generatedAt).toLocaleString("en-GB")} · Advisory planning support, not certified engineering advice.
                    </p>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={saveReport} disabled={saveBusy}>
                    {saveBusy ? <Loader2 size={13.5} className="animate-spin" aria-hidden /> : <FileDown size={13.5} aria-hidden />}
                    {saveBusy ? "Saving…" : "Save as report"}
                  </button>
                </div>
                {saveError && (
                  <div className="mx-5 mb-4 flex items-center justify-between gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger" role="alert">
                    <span>{saveError}</span>
                    <button type="button" className="text-danger underline hover:opacity-80" onClick={() => setSaveError(null)}>Dismiss</button>
                  </div>
                )}
                {savedReportId && (
                  <div className="mx-5 mb-4 flex items-center justify-between gap-2 rounded-md border border-[#1F4A3C] bg-success-soft px-3 py-2 text-[12px] text-success" role="status">
                    <span className="flex items-center gap-2"><CheckCircle2 size={14} aria-hidden /> Saved as report {savedReportId}.</span>
                    <Link href={`/reports?open=${savedReportId}`} className="font-semibold underline underline-offset-2">Open in Reports</Link>
                  </div>
                )}
                <div className="border-t border-line px-5 py-4">
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">Executive summary</h3>
                  <p className="text-[13.5px] leading-6 text-ink-2">{result.executiveSummary}</p>
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-app-bg px-3 py-2">
                    <ShieldCheck size={14} className="shrink-0 text-primary" aria-hidden />
                    <p className="text-[11.5px] text-muted">
                      <span className="font-semibold text-ink-2">Confidence {result.confidence.score}/100.</span>{" "}
                      {result.confidence.explanation}
                    </p>
                  </div>
                </div>
              </div>

              {/* Agents */}
              <div className="card">
                <div className="card-header"><p className="card-title">Planning agents — structured findings</p></div>
                <div className="divide-y divide-line">
                  {result.agents.map((agent, i) => (
                    <AgentBlock
                      key={agent.agent}
                      agent={agent}
                      open={openAgents.includes(i)}
                      onToggle={() => setOpenAgents((v) => (v.includes(i) ? v.filter((x) => x !== i) : [...v, i]))}
                    />
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="card">
                <div className="card-header">
                  <p className="card-title">Key recommendations — with rationale</p>
                </div>
                <div className="divide-y divide-line">
                  {result.recommendations.map((r, i) => (
                    <div key={r.title} className="flex gap-4 px-5 py-3.5">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">{i + 1}</span>
                      <div>
                        <p className="text-[13px] font-semibold text-ink">{r.title}</p>
                        <p className="mt-1 text-[12.5px] leading-5 text-muted">
                          <span className="font-medium text-ink-2">Why: </span>{r.rationale}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Costs */}
                <div className="card">
                  <div className="card-header"><p className="card-title">Estimated costs</p></div>
                  <div className="table-wrap">
                    <table className="tbl">
                      <thead><tr><th>Component</th><th className="text-right">₹ crore</th><th>Note</th></tr></thead>
                      <tbody>
                        {result.costs.map((c) => (
                          <tr key={c.label}>
                            <td>{c.label}</td>
                            <td className="text-right font-medium text-ink">{formatNumber(c.valueCrore)}</td>
                            <td className="text-[11.5px] text-muted">{c.note ?? "—"}</td>
                          </tr>
                        ))}
                        <tr className="bg-app-bg">
                          <td className="font-semibold text-ink">Modeled total</td>
                          <td className="text-right font-semibold text-ink">
                            {formatNumber(result.costs.reduce((s, c) => s + c.valueCrore, 0))}
                          </td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Delivery + environment */}
                <div className="space-y-4">
                  <div className="card">
                    <div className="card-header"><p className="card-title">Delivery considerations</p></div>
                    <ul className="space-y-2 px-5 py-4">
                      {result.deliveryConsiderations.map((d) => (
                        <li key={d} className="flex items-start gap-2 text-[12.5px] leading-5 text-ink-2">
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-2" aria-hidden /> {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card">
                    <div className="card-header"><p className="card-title">Environmental constraints</p></div>
                    <ul className="space-y-2 px-5 py-4">
                      {result.environmentalConstraints.map((d) => (
                        <li key={d} className="flex items-start gap-2 text-[12.5px] leading-5 text-ink-2">
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden /> {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Dependencies */}
                <div className="card">
                  <div className="card-header"><p className="card-title">Infrastructure dependencies</p></div>
                  <div className="table-wrap">
                    <table className="tbl">
                      <thead><tr><th>Item</th><th>Criticality</th><th>Note</th></tr></thead>
                      <tbody>
                        {result.dependencies.map((d) => (
                          <tr key={d.item}>
                            <td className="font-medium text-ink">{d.item}</td>
                            <td><StatusTag status={d.criticality} /></td>
                            <td className="text-[11.5px] text-muted">{d.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* Risks */}
                <div className="card">
                  <div className="card-header"><p className="card-title">Identified risks</p></div>
                  <div className="table-wrap">
                    <table className="tbl">
                      <thead><tr><th>Risk</th><th>Severity</th><th>Mitigation</th></tr></thead>
                      <tbody>
                        {result.risks.map((r) => (
                          <tr key={r.risk}>
                            <td className="font-medium text-ink">{r.risk}</td>
                            <td><RiskTag level={r.severity} /></td>
                            <td className="text-[11.5px] text-muted">{r.mitigation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Assumptions & evidence */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="card">
                  <div className="card-header"><p className="card-title">Assumptions</p></div>
                  <ul className="space-y-2 px-5 py-4">
                    {result.assumptions.map((a) => (
                      <li key={a} className="flex items-start gap-2 text-[12px] leading-5 text-muted">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-faint" aria-hidden /> {a}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card">
                  <div className="card-header"><p className="card-title">Supporting evidence</p></div>
                  <ul className="space-y-2 px-5 py-4">
                    {result.evidence.map((e) => (
                      <li key={e.label} className="flex items-center justify-between gap-3 text-[12px]">
                        <span className="text-ink-2">{e.label}</span>
                        <span className={cx("tag", e.kind === "Illustrative" ? "tag-warning" : "tag-primary")}>{e.kind}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="border-t border-line px-5 py-3 text-[10.5px] text-faint">
                    No external verified sources are attached in this prototype build.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AgentBlock({
  agent, open, onToggle,
}: {
  agent: AgentFinding;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-app-bg"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3">
          <span className="grid h-7 w-7 place-items-center rounded border border-line bg-app-bg text-[10px] font-bold text-primary">
            {agent.agent.split(" ").map((w) => w[0]).join("").slice(0, 2)}
          </span>
          <span className="text-[13px] font-semibold text-ink">{agent.agent}</span>
        </span>
        <ChevronDown size={14} className={cx("text-faint transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="anim-fade px-5 pb-4 pl-[60px]">
          <p className="text-[12.5px] leading-5 text-ink-2">{agent.summary}</p>
          <ul className="mt-2.5 space-y-1.5">
            {agent.findings.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[12px] leading-5 text-muted">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-2" aria-hidden /> {f}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {agent.metrics.map((m) => (
              <span key={m.label} className="rounded border border-line bg-app-bg px-2.5 py-1.5 text-[11px]">
                <span className="text-muted">{m.label}:</span>{" "}
                <span className="font-semibold text-ink">{m.value}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
