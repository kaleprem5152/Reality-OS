"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Download,
  FileText,
  FilePlus2,
  Loader2,
  Search,
  SearchX,
  Trash2,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { ConfirmDialog, EmptyState, Modal, PageHeader, StatusTag, RiskTag } from "@/components/ui";
import { exportReportPdf } from "@/lib/pdf";
import { buildDemoAnalysis } from "@/lib/demo-analysis";
import { reportFromAnalysis, reportFromScenarios } from "@/lib/report-builder";
import { runScenario, DEFAULT_SCENARIOS } from "@/lib/simulation";
import { cx, formatCrore, formatDate, timeAgo } from "@/lib/format";
import type { Project, Report, ReportContent } from "@/lib/types";

const REPORT_TYPES = ["Planning Analysis", "Scenario Comparison", "Risk Assessment", "Environmental Review"] as const;

function buildContent(project: Project, type: string): ReportContent {
  const analysis = buildDemoAnalysis(project, project.requirements || `Plan and evaluate ${project.name}.`, []);
  if (type === "Scenario Comparison") {
    const triples = DEFAULT_SCENARIOS.map((inputs) => ({ inputs, outputs: runScenario(inputs) }));
    return reportFromScenarios(project, triples);
  }
  return reportFromAnalysis(analysis);
}

function ReportsInner() {
  const params = useSearchParams();
  const { reports, projects, deleteReport, createReport, settings } = useApp();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get("open") || null);
  const [generateOpen, setGenerateOpen] = useState(() => params.get("generate") === "1");
  const [genProjectId, setGenProjectId] = useState(() => params.get("project") || "");
  const [genType, setGenType] = useState<string>(REPORT_TYPES[0]);
  const [genBusy, setGenBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Deep links
  const [prevParamsStr, setPrevParamsStr] = useState(() => params.toString());
  if (params.toString() !== prevParamsStr) {
    setPrevParamsStr(params.toString());
    const open = params.get("open");
    if (open) setSelectedId(open);
    if (params.get("generate") === "1") {
      setGenerateOpen(true);
      const p = params.get("project");
      if (p) setGenProjectId(p);
    }
  }

  const filtered = useMemo(() => {
    let rows = reports;
    const q = query.trim().toLowerCase();
    if (q) rows = rows.filter((r) => `${r.title} ${r.id} ${r.projectId}`.toLowerCase().includes(q));
    if (typeFilter !== "All") rows = rows.filter((r) => r.reportType === typeFilter);
    return rows;
  }, [reports, query, typeFilter]);

  const selected = filtered.find((r) => r.id === selectedId) ?? reports.find((r) => r.id === selectedId) ?? null;
  const selectedProject = selected ? projects.find((p) => p.id === selected.projectId) ?? null : null;

  const generate = async () => {
    const project = projects.find((p) => p.id === genProjectId);
    if (!project) return;
    setGenBusy(true);
    try {
      const content = buildContent(project, genType);
      const report = await createReport({
        projectId: project.id,
        title: `${project.name} — ${genType}`,
        reportType: genType,
        status: "Draft",
        content,
      });
      setGenerateOpen(false);
      setSelectedId(report.id);
    } finally {
      setGenBusy(false);
    }
  };

  const exportPdf = async () => {
    if (!selected) return;
    setPdfBusy(true);
    try {
      // Allow the button to repaint before jsPDF runs
      await new Promise((r) => setTimeout(r, 30));
      exportReportPdf(selected, selectedProject);
    } finally {
      setPdfBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteReport(deleteTarget.id);
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col" style={{ height: "calc(100vh - 130px)", minHeight: 620 }}>
      <PageHeader
        title="Reports & Evidence"
        subtitle="Retrieve, inspect, and export planning results generated from saved project and analysis data."
        actions={
          <button type="button" className="btn btn-primary mb-5" onClick={() => setGenerateOpen(true)}>
            <FilePlus2 size={14} aria-hidden /> Generate report
          </button>
        }
      />

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[400px_1fr]">
        {/* Register */}
        <section className="card flex min-h-0 flex-col overflow-hidden" aria-label="Report register">
          <div className="space-y-2 border-b border-line p-3">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
              <input className="input h-8 py-1 pl-7 text-[12px]" placeholder="Search reports…" value={query}
                onChange={(e) => setQuery(e.target.value)} aria-label="Search reports" />
            </div>
            <select className="select h-8 py-1 text-[12px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by report type">
              <option value="All">All report types</option>
              {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {reports.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No saved reports"
                body="Reports appear here when you save a planning analysis or scenario comparison. Nothing is fabricated — the register only lists reports generated from saved project data."
                action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setGenerateOpen(true)}>Generate report</button>}
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No reports match"
                body={`Nothing matches “${query}” with the current type filter.`}
                action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => { setQuery(""); setTypeFilter("All"); }}>Reset filters</button>}
              />
            ) : (
              filtered.map((r) => (
                <button key={r.id} type="button" onClick={() => setSelectedId(r.id)}
                  className={cx("w-full border-b border-line px-4 py-3 text-left transition-colors hover:bg-app-bg",
                    selectedId === r.id && "border-l-2 border-l-primary bg-primary-soft/40")}>
                  <span className="block truncate text-[12.5px] font-semibold text-ink">{r.title}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted">
                    <span className="font-mono">{r.id}</span> · {r.projectId} · {timeAgo(r.createdAt)}
                  </span>
                  <span className="mt-1.5 flex items-center gap-1.5">
                    <StatusTag status={r.reportType} />
                    <StatusTag status={r.status} />
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Viewer */}
        <section className="card flex min-h-0 flex-col overflow-hidden" aria-label="Report viewer">
          {!selected ? (
            <EmptyState
              icon={FileText}
              title="Select a report"
              body="Choose a report from the register to inspect its structured sections, or generate a new one from a project."
              action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setGenerateOpen(true)}>Generate report</button>}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-semibold text-ink">{selected.title}</h2>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {selected.id} · {selected.reportType} · Created {formatDate(selected.createdAt)} ·{" "}
                    {selectedProject ? `${selectedProject.name} (${selectedProject.id})` : selected.projectId}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusTag status={selected.status} />
                  <button type="button" className="btn btn-primary btn-sm" onClick={exportPdf} disabled={pdfBusy}>
                    {pdfBusy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Download size={12} aria-hidden />}
                    Export PDF
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(selected)}>
                    <Trash2 size={12} aria-hidden /> Delete
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <ReportBody report={selected} currency={settings.currency} />
              </div>
            </>
          )}
        </section>
      </div>

      {/* Generate dialog */}
      <Modal open={generateOpen} onClose={() => setGenerateOpen(false)} title="Generate report"
        subtitle="Builds a structured report from the project's saved data using the documented planning engine." width={520}>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="gr-project">Project</label>
            <select id="gr-project" className="select" value={genProjectId || projects[0]?.id || ""} onChange={(e) => setGenProjectId(e.target.value)}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="gr-type">Report type</label>
            <select id="gr-type" className="select" value={genType} onChange={(e) => setGenType(e.target.value)}>
              {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <p className="rounded-md border border-line bg-app-bg px-3 py-2 text-[11px] leading-4.5 text-muted">
            Content is derived from the project&apos;s saved parameters via the deterministic planning engine and is
            labeled as internal analysis with illustrative evidence. It is persisted to the workspace and exportable to PDF.
          </p>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" className="btn btn-ghost" onClick={() => setGenerateOpen(false)} disabled={genBusy}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={generate} disabled={genBusy || projects.length === 0}>
              {genBusy && <Loader2 size={13} className="animate-spin" aria-hidden />}
              {genBusy ? "Generating…" : "Generate & open"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title="Delete report"
        body={`Permanently delete report “${deleteTarget?.title}” (${deleteTarget?.id})? This cannot be undone.`}
        confirmLabel="Delete report"
      />
    </div>
  );
}

function ReportBody({ report, currency }: { report: Report; currency: "INR" | "USD" }) {
  const c = report.content;
  return (
    <div className="mx-auto max-w-[760px]">
      <Section n="1" title="Executive summary">
        <p className="text-[13.5px] leading-6.5 text-ink-2">{c.executiveSummary}</p>
      </Section>

      <Section n="2" title="Planning assumptions">
        <ul className="space-y-1.5">
          {c.assumptions.map((a) => (
            <li key={a} className="flex items-start gap-2 text-[12.5px] leading-5 text-muted">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-2" aria-hidden /> {a}
            </li>
          ))}
        </ul>
      </Section>

      <Section n="3" title="Cost breakdown">
        <div className="table-wrap rounded-md border border-line">
          <table className="tbl">
            <thead><tr><th>Component</th><th className="text-right">Value</th><th>Note</th></tr></thead>
            <tbody>
              {c.costBreakdown.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="text-right font-medium text-ink">{formatCrore(r.valueCrore, currency)}</td>
                  <td className="text-[11.5px] text-muted">{r.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section n="4" title="Proposed milestones">
        <div className="space-y-2">
          {c.milestones.map((m) => (
            <div key={m.phase} className="flex gap-4 rounded-md border border-line px-3.5 py-2.5">
              <div className="w-40 shrink-0">
                <p className="text-[12px] font-semibold text-ink">{m.phase}</p>
                <p className="text-[10.5px] text-faint">{m.window}</p>
              </div>
              <p className="text-[12px] leading-5 text-muted">{m.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section n="5" title="Risk register">
        <div className="table-wrap rounded-md border border-line">
          <table className="tbl">
            <thead><tr><th>Risk</th><th>Severity</th><th>Mitigation</th></tr></thead>
            <tbody>
              {c.riskRegister.map((r) => (
                <tr key={r.risk}>
                  <td className="font-medium text-ink">{r.risk}</td>
                  <td><RiskTag level={r.severity} /></td>
                  <td className="text-[11.5px] text-muted">{r.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section n="6" title="Environmental considerations">
        <ul className="space-y-1.5">
          {c.environmental.map((e) => (
            <li key={e} className="flex items-start gap-2 text-[12.5px] leading-5 text-muted">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden /> {e}
            </li>
          ))}
        </ul>
      </Section>

      <Section n="7" title="Recommendations">
        <div className="space-y-3">
          {c.recommendations.map((r, i) => (
            <div key={r.title} className="flex gap-3">
              <span className="grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full bg-primary-soft text-[10px] font-bold text-primary">{i + 1}</span>
              <div>
                <p className="text-[12.5px] font-semibold text-ink">{r.title}</p>
                <p className="mt-0.5 text-[12px] leading-5 text-muted"><span className="font-medium text-ink-2">Why:</span> {r.rationale}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section n="8" title="Evidence and source references">
        <div className="table-wrap rounded-md border border-line">
          <table className="tbl">
            <thead><tr><th>Reference</th><th>Nature</th></tr></thead>
            <tbody>
              {c.evidence.map((e) => (
                <tr key={e.label}>
                  <td>{e.label}</td>
                  <td>
                    <span className={cx("tag", e.kind === "Illustrative" ? "tag-warning" : "tag-primary")}>
                      {e.kind === "Illustrative" ? "Illustrative" : "Internal analysis"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10.5px] leading-4.5 text-faint">
          No external verified sources are attached in this prototype build; illustrative evidence is not a substitute for verified data.
        </p>
      </Section>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2.5 flex items-baseline gap-2 border-b border-line pb-2 text-[13.5px] font-semibold text-ink">
        <span className="text-[11px] font-bold text-faint">{n}.</span> {title}
      </h3>
      {children}
    </section>
  );
}

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsInner />
    </Suspense>
  );
}
