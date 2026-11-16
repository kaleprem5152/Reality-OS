"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileDown,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { EmptyState, PageHeader, StatusTag, RiskTag } from "@/components/ui";
import { api } from "@/lib/api-client";
import { buildDemoAnalysis } from "@/lib/demo-analysis";
import { reportFromAnalysis } from "@/lib/report-builder";
import { cx, formatCrore, formatNumber } from "@/lib/format";
import type {
  AgentFinding,
  AnalysisResult,
  DetailedAiReview,
  ProjectHealthStatus,
} from "@/lib/types";

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
  const [copied, setCopied] = useState(false);

  // Section collapse state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    executive: true,
    understanding: true,
    progress: true,
    risks: true,
    budget: true,
    technical: true,
    recommendations: true,
    actionPlan: true,
    conclusion: true,
    agents: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllSections = (expand: boolean) => {
    setExpandedSections({
      executive: expand,
      understanding: expand,
      progress: expand,
      risks: expand,
      budget: expand,
      technical: expand,
      recommendations: expand,
      actionPlan: expand,
      conclusion: expand,
      agents: expand,
    });
  };

  const project = useMemo(
    () => activeProjects.find((p) => p.id === projectId) ?? null,
    [activeProjects, projectId],
  );

  // Load AI integration status
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
      setNotice("Enter a requirements brief of at least 20 characters before running the review.");
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
        setNotice(
          `Live Gemini analysis failed (${e instanceof Error ? e.message : "unknown error"}). Showing comprehensive deterministic evaluation instead.`,
        );
      }
    }

    // Deterministic evaluation path
    await new Promise((r) => setTimeout(r, 450));
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
        title: `${result.projectName} — Comprehensive AI Project Review`,
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

  const copyFullReview = () => {
    if (!result) return;
    const rev = result.detailedReview;
    if (!rev) {
      navigator.clipboard.writeText(result.executiveSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    const md = [
      `# AI Project Review — ${result.projectName}`,
      `Generated: ${new Date(result.generatedAt).toLocaleString("en-GB")}`,
      `Overall Health: ${rev.executiveSummary.projectHealth}`,
      ``,
      `## 1. Executive Summary`,
      rev.executiveSummary.overallAssessment,
      `Health Explanation: ${rev.executiveSummary.healthExplanation}`,
      `Key Strengths:\n${rev.executiveSummary.keyStrengths.map((s) => `- ${s}`).join("\n")}`,
      `Key Concerns:\n${rev.executiveSummary.keyConcerns.map((c) => `- ${c}`).join("\n")}`,
      ``,
      `## 2. Project Understanding`,
      `Objectives & Scope: ${rev.projectUnderstanding.objectivesAndScope}`,
      `Expected Outcomes:\n${rev.projectUnderstanding.expectedOutcomes.map((o) => `- ${o}`).join("\n")}`,
      `Current Progress: ${rev.projectUnderstanding.currentProgress}`,
      `Budget & Timeline Context: ${rev.projectUnderstanding.budgetAndTimelineContext}`,
      ``,
      `## 3. Progress and Performance Analysis`,
      `Planned vs Actual: ${rev.progressPerformance.plannedVsActual}`,
      `Schedule Performance: ${rev.progressPerformance.schedulePerformance}`,
      `Budget Utilization: ${rev.progressPerformance.budgetUtilization}`,
      ``,
      `## 4. Risk Assessment`,
      ...rev.riskAssessment.map((r) => `### ${r.risk} (${r.severity})\n- Likelihood: ${r.likelihood} | Impact: ${r.impact}\n- Evidence: ${r.supportingEvidence}\n- Mitigation: ${r.mitigation}\n- Owner: ${r.recommendedOwner}`),
      ``,
      `## 5. Budget and Resource Analysis`,
      ...rev.budgetAndResources.allocationAndUtilization.map((b) => `- ${b.component}: ₹${b.valueCrore} cr (${b.note})`),
      `Potential Overruns: ${rev.budgetAndResources.potentialOverruns}`,
      ``,
      `## 6. Technical and Operational Assessment`,
      `Feasibility: ${rev.technicalAndOperational.technicalFeasibility}`,
      `Readiness: ${rev.technicalAndOperational.operationalReadiness}`,
      ``,
      `## 7. Recommendations`,
      ...rev.recommendations.map((r, i) => `${i + 1}. **${r.title}** [${r.priority} | ${r.urgency}]\n   - Why: ${r.whyItMatters}\n   - Benefit: ${r.expectedBenefit}\n   - Approach: ${r.implementationApproach}`),
      ``,
      `## 8. Action Plan`,
      `Immediate (30 days):\n${rev.actionPlan.immediateActions.map((a) => `- [${a.owner}] ${a.action} (Outcome: ${a.expectedOutcome})`).join("\n")}`,
      `Short-Term (90 days):\n${rev.actionPlan.shortTermActions.map((a) => `- [${a.owner}] ${a.action} (Outcome: ${a.expectedOutcome})`).join("\n")}`,
      `Medium-Term (180 days):\n${rev.actionPlan.mediumTermActions.map((a) => `- [${a.owner}] ${a.action} (Outcome: ${a.expectedOutcome})`).join("\n")}`,
      ``,
      `## 9. Conclusion`,
      rev.conclusion.outlook,
      `Critical Issues:\n${rev.conclusion.criticalIssues.map((ci) => `- ${ci}`).join("\n")}`,
      `Next Steps:\n${rev.conclusion.nextSteps.map((ns) => `- ${ns}`).join("\n")}`,
    ].join("\n");

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const detailed = result?.detailedReview;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="AI Planning Studio"
        subtitle="Multi-agent infrastructure synthesis, digital twin scenario reconciliation, and evidence-backed consultant review."
        actions={
          result && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={copyFullReview}
                title="Copy markdown review to clipboard"
              >
                {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                <span>{copied ? "Copied to clipboard" : "Copy review"}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={run}
                disabled={running}
                title="Re-run review with current parameters"
              >
                <RotateCcw size={13} />
                <span>Regenerate</span>
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={saveReport}
                disabled={saveBusy}
              >
                {saveBusy ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
                <span>{saveBusy ? "Saving…" : "Save as report"}</span>
              </button>
            </div>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Controls sidebar */}
        <section aria-label="Review parameters" className="space-y-4">
          <div className="card space-y-4 p-5">
            <div>
              <label className="label" htmlFor="st-project">Project</label>
              <select
                id="st-project"
                className="select"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="st-req">Requirements & Scope Brief</label>
              <textarea
                id="st-req"
                rows={5}
                className="textarea"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="Describe corridor scope, operational constraints, budget limits, and priorities…"
              />
              <p className="mt-1 text-[10px] text-faint">{requirements.trim().length} characters (minimum 20)</p>
            </div>

            <fieldset>
              <legend className="label">Strategic Objectives</legend>
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
                <p><span className="font-medium text-ink-2">Authorized Budget:</span> {formatCrore(project.budgetCrore, settings.currency)}</p>
                <p className="mt-0.5"><span className="font-medium text-ink-2">Current Lifecycle:</span> {project.status}</p>
                <p className="mt-0.5"><span className="font-medium text-ink-2">Recorded Risk:</span> {project.riskLevel}</p>
                <p className="mt-0.5">
                  <span className="font-medium text-ink-2">Sustainability:</span>{" "}
                  {project.sustainabilityPriorities.join(", ") || "None recorded in register"}
                </p>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={run}
              disabled={running || !project}
            >
              {running ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Play size={13.5} aria-hidden />}
              {running ? (aiConfigured ? "Generating Gemini Review…" : "Computing Deterministic Evaluation…") : "Generate AI Review"}
            </button>

            {notice && (
              <div className="flex items-start gap-2 rounded-md border border-[#4A3B1E] bg-warning-soft px-3 py-2 text-[11.5px] leading-4.5 text-warning" role="alert">
                <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden /> {notice}
              </div>
            )}
          </div>
        </section>

        {/* Results review document */}
        <section aria-label="Review report" className="min-w-0">
          {running && (
            <div className="card flex flex-col items-center justify-center gap-3 py-24 text-center">
              <Loader2 size={26} className="animate-spin text-primary" aria-hidden />
              <p className="text-[14px] font-semibold text-ink">
                {aiConfigured ? "Synthesizing Live Gemini Consultant Review…" : "Running Evidence-Based Deterministic Engine…"}
              </p>
              <p className="max-w-md text-[12px] text-muted">
                Evaluating corridor performance, budget headroom, cross-sector dependencies, and generating the 9-part advisory assessment.
              </p>
            </div>
          )}

          {!running && !result && (
            <div className="card">
              <EmptyState
                icon={BrainCircuit}
                title="No Review Generated Yet"
                body="Select an infrastructure project and requirements brief, then click 'Generate AI Review'. The consultant pipeline performs an evidence-based 9-section analysis covering executive health, schedule, budget, risks, technical readiness, recommendations, and an action plan."
              />
            </div>
          )}

          {!running && result && (
            <div className="space-y-5">
              {/* Review Header Banner */}
              <div className="card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-[18px] font-semibold tracking-tight text-ink">
                        Comprehensive AI Project Review — {result.projectName}
                      </h2>
                      {result.mode === "demo" ? (
                        <span className="tag tag-warning">Demo Review · Deterministic</span>
                      ) : (
                        <span className="tag tag-success">Live Gemini Review</span>
                      )}
                    </div>
                    <p className="mt-1 text-[11.5px] text-muted">
                      Evaluated {new Date(result.generatedAt).toLocaleString("en-GB")} · Professional infrastructure consultant assessment.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAllSections(true)}
                      className="text-[11.5px] text-muted hover:text-ink transition-colors"
                    >
                      Expand all
                    </button>
                    <span className="text-faint">·</span>
                    <button
                      type="button"
                      onClick={() => toggleAllSections(false)}
                      className="text-[11.5px] text-muted hover:text-ink transition-colors"
                    >
                      Collapse all
                    </button>
                  </div>
                </div>

                {saveError && (
                  <div className="mx-5 my-3 flex items-center justify-between gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger" role="alert">
                    <span>{saveError}</span>
                    <button type="button" className="text-danger underline hover:opacity-80" onClick={() => setSaveError(null)}>Dismiss</button>
                  </div>
                )}
                {savedReportId && (
                  <div className="mx-5 my-3 flex items-center justify-between gap-2 rounded-md border border-[#1F4A3C] bg-success-soft px-3 py-2 text-[12px] text-success" role="status">
                    <span className="flex items-center gap-2"><CheckCircle2 size={14} aria-hidden /> Saved to workspace reports as {savedReportId}.</span>
                    <Link href={`/reports?open=${savedReportId}`} className="font-semibold underline underline-offset-2">Open in Reports</Link>
                  </div>
                )}
              </div>

              {/* SECTION 1: EXECUTIVE SUMMARY */}
              {detailed && (
                <ReportSection
                  n="1"
                  title="Executive Summary & Project Health"
                  isOpen={expandedSections.executive}
                  onToggle={() => toggleSection("executive")}
                >
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-app-bg p-4">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Current Project Health</span>
                        <div className="mt-1 flex items-center gap-2.5">
                          <HealthBadge health={detailed.executiveSummary.projectHealth} />
                          <span className="text-[12.5px] text-ink-2">{detailed.executiveSummary.healthExplanation}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded border border-line bg-surface px-3 py-1.5 text-[11.5px]">
                        <ShieldCheck size={14} className="text-primary" />
                        <span>Confidence: <strong className="text-ink">{result.confidence.score}/100</strong></span>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Overall Assessment</h4>
                      <p className="text-[13px] leading-6 text-ink-2">{detailed.executiveSummary.overallAssessment}</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-md border border-success/30 bg-success/5 p-3.5">
                        <h5 className="flex items-center gap-1.5 text-[12px] font-semibold text-success">
                          <CheckCircle2 size={14} /> Key Strengths
                        </h5>
                        <ul className="mt-2 space-y-1.5">
                          {detailed.executiveSummary.keyStrengths.map((str) => (
                            <li key={str} className="flex items-start gap-2 text-[12px] text-ink-2">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                              <span>{str}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-md border border-critical/30 bg-critical/5 p-3.5">
                        <h5 className="flex items-center gap-1.5 text-[12px] font-semibold text-critical">
                          <ShieldAlert size={14} /> Most Important Concerns
                        </h5>
                        <ul className="mt-2 space-y-1.5">
                          {detailed.executiveSummary.keyConcerns.map((con) => (
                            <li key={con} className="flex items-start gap-2 text-[12px] text-ink-2">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-critical" />
                              <span>{con}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </ReportSection>
              )}

              {/* SECTION 2: PROJECT UNDERSTANDING */}
              {detailed && (
                <ReportSection
                  n="2"
                  title="Project Understanding & Scope Baseline"
                  isOpen={expandedSections.understanding}
                  onToggle={() => toggleSection("understanding")}
                >
                  <div className="space-y-4 text-[12.5px] text-ink-2 leading-relaxed">
                    <div>
                      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Objectives & Scope</h4>
                      <p>{detailed.projectUnderstanding.objectivesAndScope}</p>
                    </div>

                    <div>
                      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">Expected Strategic Outcomes</h4>
                      <ul className="space-y-1.5">
                        {detailed.projectUnderstanding.expectedOutcomes.map((eo) => (
                          <li key={eo} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{eo}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 rounded-md border border-line bg-app-bg p-3.5">
                      <div>
                        <span className="text-[11px] text-muted">Current Progress Stage:</span>
                        <p className="font-semibold text-ink">{detailed.projectUnderstanding.currentProgress}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted">Budget & Timeline Context:</span>
                        <p className="font-semibold text-ink">{detailed.projectUnderstanding.budgetAndTimelineContext}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Important Assumptions (Clearly Labeled)</h4>
                      <ul className="space-y-1 text-muted text-[12px]">
                        {detailed.projectUnderstanding.assumptions.map((ass) => (
                          <li key={ass} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-faint" />
                            <span>{ass}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </ReportSection>
              )}

              {/* SECTION 3: PROGRESS & PERFORMANCE ANALYSIS */}
              {detailed && (
                <ReportSection
                  n="3"
                  title="Progress & Performance Analysis"
                  isOpen={expandedSections.progress}
                  onToggle={() => toggleSection("progress")}
                >
                  <div className="space-y-4">
                    <div className="table-wrap rounded-md border border-line">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Milestone / Phase</th>
                            <th>Target Window</th>
                            <th>Status</th>
                            <th>Technical Detail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailed.progressPerformance.milestoneAnalysis.map((m) => (
                            <tr key={m.phase}>
                              <td className="font-semibold text-ink">{m.phase}</td>
                              <td className="text-muted text-[11.5px]">{m.window}</td>
                              <td><StatusTag status={m.status} /></td>
                              <td className="text-[12px] text-ink-2">{m.detail}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 text-[12px]">
                      <div className="rounded-md border border-line bg-app-bg p-3">
                        <span className="text-[10.5px] uppercase font-semibold text-muted">Planned vs. Actual</span>
                        <p className="mt-1 text-ink-2">{detailed.progressPerformance.plannedVsActual}</p>
                      </div>
                      <div className="rounded-md border border-line bg-app-bg p-3">
                        <span className="text-[10.5px] uppercase font-semibold text-muted">Schedule Performance</span>
                        <p className="mt-1 text-ink-2">{detailed.progressPerformance.schedulePerformance}</p>
                      </div>
                      <div className="rounded-md border border-line bg-app-bg p-3">
                        <span className="text-[10.5px] uppercase font-semibold text-muted">Budget Utilization</span>
                        <p className="mt-1 text-ink-2">{detailed.progressPerformance.budgetUtilization}</p>
                      </div>
                    </div>

                    {detailed.progressPerformance.bottlenecksAndDelays.length > 0 && (
                      <div>
                        <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-critical">Critical Bottlenecks & Delays</h4>
                        <ul className="space-y-1 text-[12px] text-ink-2">
                          {detailed.progressPerformance.bottlenecksAndDelays.map((b) => (
                            <li key={b} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-critical" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </ReportSection>
              )}

              {/* SECTION 4: RISK ASSESSMENT */}
              {detailed && (
                <ReportSection
                  n="4"
                  title="Risk Assessment & Mitigation Matrix"
                  isOpen={expandedSections.risks}
                  onToggle={() => toggleSection("risks")}
                >
                  <div className="table-wrap rounded-md border border-line">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Identified Risk</th>
                          <th>Likelihood</th>
                          <th>Impact</th>
                          <th>Severity</th>
                          <th>Supporting Evidence</th>
                          <th>Mitigation Strategy</th>
                          <th>Owner / Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailed.riskAssessment.map((r) => (
                          <tr key={r.risk}>
                            <td className="font-semibold text-ink max-w-[200px]">{r.risk}</td>
                            <td><span className="text-[11.5px] text-muted">{r.likelihood}</span></td>
                            <td><span className="text-[11.5px] text-muted">{r.impact}</span></td>
                            <td><RiskTag level={r.severity} /></td>
                            <td className="text-[11.5px] text-muted max-w-[220px]">{r.supportingEvidence}</td>
                            <td className="text-[12px] text-ink-2 max-w-[240px]">{r.mitigation}</td>
                            <td className="text-[11.5px] font-medium text-primary whitespace-nowrap">{r.recommendedOwner}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ReportSection>
              )}

              {/* SECTION 5: BUDGET & RESOURCE ANALYSIS */}
              {detailed && (
                <ReportSection
                  n="5"
                  title="Budget & Resource Analysis"
                  isOpen={expandedSections.budget}
                  onToggle={() => toggleSection("budget")}
                >
                  <div className="space-y-4">
                    <div className="table-wrap rounded-md border border-line">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Cost Component</th>
                            <th className="text-right">Modeled Value</th>
                            <th>Note / Scope Coverage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailed.budgetAndResources.allocationAndUtilization.map((c) => (
                            <tr key={c.component}>
                              <td className="font-semibold text-ink">{c.component}</td>
                              <td className="text-right font-medium text-ink">{formatCrore(c.valueCrore, settings.currency)}</td>
                              <td className="text-[11.5px] text-muted">{c.note || "—"}</td>
                            </tr>
                          ))}
                          <tr className="bg-app-bg font-semibold">
                            <td className="text-ink">Total Direct Expenditure</td>
                            <td className="text-right text-ink">
                              {formatCrore(
                                detailed.budgetAndResources.allocationAndUtilization.reduce((s, c) => s + c.valueCrore, 0),
                                settings.currency,
                              )}
                            </td>
                            <td className="text-[11px] text-muted">Against authorized envelope of {formatCrore(project?.budgetCrore ?? 0, settings.currency)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="rounded-md border border-line bg-app-bg p-3.5 text-[12px] leading-relaxed">
                      <h5 className="font-semibold text-ink">Capital Overrun & Headroom Analysis</h5>
                      <p className="mt-1 text-ink-2">{detailed.budgetAndResources.potentialOverruns}</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="card p-3.5">
                        <h5 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">Resource Constraints</h5>
                        <ul className="mt-2 space-y-1.5 text-[12px] text-ink-2">
                          {detailed.budgetAndResources.resourceConstraints.map((rc) => (
                            <li key={rc} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-2" />
                              <span>{rc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="card p-3.5">
                        <h5 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">Optimization Opportunities</h5>
                        <ul className="mt-2 space-y-1.5 text-[12px] text-ink-2">
                          {detailed.budgetAndResources.optimizationOpportunities.map((oo) => (
                            <li key={oo} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                              <span>{oo}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <p className="text-[11px] text-faint italic border-t border-line pt-2">
                      {detailed.budgetAndResources.figuresNote}
                    </p>
                  </div>
                </ReportSection>
              )}

              {/* SECTION 6: TECHNICAL & OPERATIONAL ASSESSMENT */}
              {detailed && (
                <ReportSection
                  n="6"
                  title="Technical & Operational Assessment"
                  isOpen={expandedSections.technical}
                  onToggle={() => toggleSection("technical")}
                >
                  <div className="space-y-4 text-[12.5px] text-ink-2 leading-relaxed">
                    <div>
                      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Technical Feasibility</h4>
                      <p>{detailed.technicalAndOperational.technicalFeasibility}</p>
                    </div>

                    <div>
                      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">Infrastructure Dependencies</h4>
                      <div className="table-wrap rounded-md border border-line">
                        <table className="tbl">
                          <thead>
                            <tr>
                              <th>Dependency Item</th>
                              <th>Criticality</th>
                              <th>Technical Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailed.technicalAndOperational.dependencies.map((d) => (
                              <tr key={d.item}>
                                <td className="font-semibold text-ink">{d.item}</td>
                                <td><StatusTag status={d.criticality} /></td>
                                <td className="text-[11.5px] text-muted">{d.note}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-md border border-line bg-app-bg p-3.5">
                        <h5 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">Implementation Concerns</h5>
                        <ul className="mt-2 space-y-1 text-[12px] text-ink-2">
                          {detailed.technicalAndOperational.implementationConcerns.map((ic) => (
                            <li key={ic} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                              <span>{ic}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-md border border-line bg-app-bg p-3.5">
                        <h5 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">Operational Readiness</h5>
                        <p className="mt-2 text-[12px] text-ink-2">{detailed.technicalAndOperational.operationalReadiness}</p>
                      </div>
                    </div>
                  </div>
                </ReportSection>
              )}

              {/* SECTION 7: RECOMMENDATIONS */}
              {detailed && (
                <ReportSection
                  n="7"
                  title="Prioritized Strategic Recommendations"
                  isOpen={expandedSections.recommendations}
                  onToggle={() => toggleSection("recommendations")}
                >
                  <div className="space-y-3.5">
                    {detailed.recommendations.map((rec, i) => (
                      <div key={rec.title} className="rounded-lg border border-line bg-app-bg p-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-soft text-[10px] font-bold text-primary">
                              {i + 1}
                            </span>
                            <h4 className="text-[14px] font-semibold text-ink">{rec.title}</h4>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={cx(
                              "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                              rec.priority === "High" ? "bg-critical/20 text-critical border border-critical/30" : "bg-warning/20 text-warning border border-warning/30"
                            )}>
                              {rec.priority} Priority
                            </span>
                            <span className="rounded bg-surface px-2 py-0.5 text-[10px] text-muted border border-line">
                              {rec.urgency}
                            </span>
                          </div>
                        </div>

                        <div className="grid gap-2 text-[12.5px] leading-relaxed pt-1">
                          <p><strong className="text-ink-2">Why it matters:</strong> <span className="text-muted">{rec.whyItMatters}</span></p>
                          <p><strong className="text-ink-2">Expected benefit:</strong> <span className="text-muted">{rec.expectedBenefit}</span></p>
                          <p><strong className="text-ink-2">Suggested implementation:</strong> <span className="text-muted">{rec.implementationApproach}</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ReportSection>
              )}

              {/* SECTION 8: ACTION PLAN */}
              {detailed && (
                <ReportSection
                  n="8"
                  title="Phased Implementation Action Plan"
                  isOpen={expandedSections.actionPlan}
                  onToggle={() => toggleSection("actionPlan")}
                >
                  <div className="grid gap-4 lg:grid-cols-3">
                    <ActionPhaseCard
                      phaseTitle="Immediate Actions"
                      timelineBadge="Next 30 Days"
                      badgeColor="bg-critical/20 text-critical border-critical/30"
                      actions={detailed.actionPlan.immediateActions}
                    />
                    <ActionPhaseCard
                      phaseTitle="Short-Term Actions"
                      timelineBadge="30–90 Days"
                      badgeColor="bg-warning/20 text-warning border-warning/30"
                      actions={detailed.actionPlan.shortTermActions}
                    />
                    <ActionPhaseCard
                      phaseTitle="Medium-Term Actions"
                      timelineBadge="90–180 Days"
                      badgeColor="bg-primary-soft text-primary border-primary/30"
                      actions={detailed.actionPlan.mediumTermActions}
                    />
                  </div>
                </ReportSection>
              )}

              {/* SECTION 9: CONCLUSION */}
              {detailed && (
                <ReportSection
                  n="9"
                  title="Conclusion & Next Strategic Steps"
                  isOpen={expandedSections.conclusion}
                  onToggle={() => toggleSection("conclusion")}
                >
                  <div className="space-y-4">
                    <div>
                      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Overall Project Outlook</h4>
                      <p className="text-[13px] leading-6 text-ink-2">{detailed.conclusion.outlook}</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-md border border-[#4D2727] bg-critical-soft/30 p-3.5">
                        <h5 className="text-[12px] font-semibold text-critical">Critical Issues Requiring Steering Attention</h5>
                        <ul className="mt-2 space-y-1.5 text-[12px] text-ink-2">
                          {detailed.conclusion.criticalIssues.map((ci) => (
                            <li key={ci} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-critical" />
                              <span>{ci}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-md border border-[#1F4A3C] bg-success-soft/30 p-3.5">
                        <h5 className="text-[12px] font-semibold text-success">Recommended Next Steps</h5>
                        <ul className="mt-2 space-y-1.5 text-[12px] text-ink-2">
                          {detailed.conclusion.nextSteps.map((ns) => (
                            <li key={ns} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                              <span>{ns}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </ReportSection>
              )}

              {/* OPTIONAL EXPANDABLE DOMAIN AGENT FINDINGS */}
              <div className="card">
                <button
                  type="button"
                  onClick={() => toggleSection("agents")}
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-app-bg"
                  aria-expanded={expandedSections.agents}
                >
                  <div className="flex items-center gap-2">
                    <Layers size={15} className="text-primary" />
                    <span className="text-[13px] font-semibold text-ink">Domain Agent Findings & Technical Metrics</span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={cx("text-muted transition-transform", expandedSections.agents && "rotate-180")}
                  />
                </button>

                {expandedSections.agents && (
                  <div className="divide-y divide-line border-t border-line">
                    {result.agents.map((agent) => (
                      <div key={agent.agent} className="p-4 space-y-2">
                        <h5 className="text-[12.5px] font-semibold text-ink">{agent.agent}</h5>
                        <p className="text-[12px] text-muted">{agent.summary}</p>
                        <ul className="space-y-1 text-[11.5px] text-ink-2">
                          {agent.findings.map((f) => (
                            <li key={f} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {agent.metrics.map((m) => (
                            <span key={m.label} className="rounded border border-line bg-app-bg px-2 py-1 text-[10.5px]">
                              <span className="text-muted">{m.label}:</span> <strong className="text-ink">{m.value}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ReportSection({
  n,
  title,
  isOpen,
  onToggle,
  children,
}: {
  n: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between border-b border-line px-5 py-3.5 text-left transition-colors hover:bg-app-bg"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2.5">
          <span className="grid h-6 w-6 place-items-center rounded bg-primary-soft text-[11px] font-bold text-primary">
            {n}
          </span>
          <span className="text-[14px] font-semibold text-ink">{title}</span>
        </span>
        <ChevronDown
          size={14}
          className={cx("text-muted transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen && <div className="p-5">{children}</div>}
    </div>
  );
}

function HealthBadge({ health }: { health: ProjectHealthStatus }) {
  const styles: Record<ProjectHealthStatus, string> = {
    Good: "border-success/40 bg-success/15 text-success",
    Fair: "border-warning/40 bg-warning/15 text-warning",
    Poor: "border-[#E67E22]/40 bg-[#E67E22]/15 text-[#E67E22]",
    Critical: "border-critical/40 bg-critical/15 text-critical",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-bold tracking-wide",
        styles[health] || styles.Fair,
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
      {health}
    </span>
  );
}

function ActionPhaseCard({
  phaseTitle,
  timelineBadge,
  badgeColor,
  actions,
}: {
  phaseTitle: string;
  timelineBadge: string;
  badgeColor: string;
  actions: { action: string; owner: string; expectedOutcome: string }[];
}) {
  return (
    <div className="rounded-lg border border-line bg-app-bg p-4 flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
          <h5 className="text-[13px] font-semibold text-ink">{phaseTitle}</h5>
          <span className={cx("rounded border px-2 py-0.5 text-[10px] font-semibold", badgeColor)}>
            {timelineBadge}
          </span>
        </div>
        <div className="mt-3 space-y-2.5">
          {actions.map((act) => (
            <div key={act.action} className="text-[12px] space-y-1">
              <p className="font-medium text-ink-2 leading-snug">{act.action}</p>
              <div className="flex items-center justify-between text-[10.5px] text-muted">
                <span>Role: <strong className="text-primary">{act.owner}</strong></span>
              </div>
              <p className="text-[11px] text-faint">Target: {act.expectedOutcome}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
