"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  GitCompareArrows,
  PencilLine,
  Sparkles,
  Trash2,
  FileText,
  FolderOpen,
  ArrowRight,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { ProjectEditModal } from "@/components/projects/ProjectEditModal";
import { ConfirmDialog, EmptyState, KeyValue, RiskTag, StatusTag, DemoBanner } from "@/components/ui";
import { formatCrore, formatDate, timeAgo } from "@/lib/format";

function DetailInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const { projects, reports, updateProject, deleteProject, settings, requestStudioRun } = useApp();
  const project = projects.find((p) => p.id === id);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const createdBanner = params.get("created") === "1";

  if (!project) {
    return (
      <div className="card mx-auto max-w-[1400px]">
        <EmptyState
          icon={FolderOpen}
          title="Project not found"
          body={`No project with ID ${id} exists in the register. It may have been deleted.`}
          action={
            <Link href="/projects" className="btn btn-primary btn-sm">Back to projects</Link>
          }
        />
      </div>
    );
  }

  const relatedReports = reports.filter((r) => r.projectId === project.id);

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await deleteProject(project.id);
      router.push("/projects");
    } finally {
      setBusy(false);
    }
  };

  const runAnalysis = () => {
    requestStudioRun({
      projectId: project.id,
      requirements: project.requirements || `Plan and evaluate ${project.name}.`,
      objectives: [],
    });
    router.push("/studio");
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      {createdBanner && (
        <div className="anim-pop mb-4 flex items-center gap-2 rounded-md border border-[#1F4A3C] bg-success-soft px-4 py-2.5 text-[12.5px] text-success" role="status">
          <CheckCircle2 size={15} aria-hidden />
          Project created and saved to the register. It is now searchable across the workspace.
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">{project.name}</h1>
            <StatusTag status={project.status} />
            <RiskTag level={project.riskLevel} />
          </div>
          <p className="mt-1.5 text-[13px] text-muted">
            {project.id} · {project.infraType} · {project.region}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={runAnalysis}>
            <Sparkles size={13.5} aria-hidden /> Run planning analysis
          </button>
          <Link href="/twin" className="btn btn-secondary">
            <GitCompareArrows size={13.5} aria-hidden /> Compare scenarios
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(true)}>
            <PencilLine size={13.5} aria-hidden /> Edit
          </button>
          {project.archived ? (
            <button type="button" className="btn btn-secondary" onClick={() => void updateProject(project.id, { archived: false })}>
              <ArchiveRestore size={13.5} aria-hidden /> Restore
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => void updateProject(project.id, { archived: true })}>
              <Archive size={13.5} aria-hidden /> Archive
            </button>
          )}
          <button type="button" className="btn btn-danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={13.5} aria-hidden /> Delete
          </button>
        </div>
      </div>

      {project.archived && (
        <div className="mb-4">
          <DemoBanner text="This project is archived — it is hidden from the default register view and portfolio metrics." />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          <section className="card" aria-label="Project overview">
            <div className="card-header"><p className="card-title">Overview</p></div>
            <div className="p-4">
              <p className="text-[13px] leading-6 text-ink-2">{project.description || "No description provided."}</p>
              <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-4">
                <Stat label="Estimated budget" value={formatCrore(project.budgetCrore, settings.currency)} />
                <Stat label="Target completion" value={project.targetCompletion} />
                {typeof project.stations === "number" && <Stat label="Stations" value={String(project.stations)} />}
                {typeof project.corridorKm === "number" && <Stat label="Corridor" value={`${project.corridorKm} km`} />}
                <Stat label="Created" value={formatDate(project.createdAt)} />
                <Stat label="Updated" value={timeAgo(project.updatedAt)} />
              </div>
            </div>
          </section>

          <section className="card" aria-label="Requirements brief">
            <div className="card-header">
              <p className="card-title">Requirements brief</p>
              <button type="button" onClick={runAnalysis} className="text-[11.5px] font-medium text-primary hover:text-primary-hover">
                Send to Planning Studio
              </button>
            </div>
            <div className="p-4">
              <blockquote className="border-l-2 border-primary bg-app-bg px-4 py-3 text-[13px] leading-6 text-ink-2">
                {project.requirements || "No requirements brief recorded for this project."}
              </blockquote>
              {project.capacityTarget && (
                <p className="mt-3 text-[12px] text-muted">
                  <span className="font-medium text-ink-2">Capacity target:</span> {project.capacityTarget}
                </p>
              )}
              {project.sustainabilityPriorities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {project.sustainabilityPriorities.map((p) => (
                    <span key={p} className="tag tag-success">{p}</span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="card" aria-label="Related reports">
            <div className="card-header">
              <p className="card-title">Reports & evidence</p>
              <Link href={`/reports?generate=1&project=${project.id}`} className="text-[11.5px] font-medium text-primary hover:text-primary-hover">
                Generate report
              </Link>
            </div>
            {relatedReports.length === 0 ? (
              <div className="p-4 text-[12px] text-muted">
                No saved reports for this project yet. Run a planning analysis or scenario comparison and save it as a report.
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {relatedReports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/reports?open=${r.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-app-bg">
                      <FileText size={15} className="shrink-0 text-faint" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-ink">{r.title}</span>
                        <span className="text-[11px] text-muted">{r.id} · {r.reportType} · {formatDate(r.createdAt)}</span>
                      </span>
                      <StatusTag status={r.status} />
                      <ArrowRight size={13} className="text-faint" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <section className="card" aria-label="Register metadata">
            <div className="card-header"><p className="card-title">Register metadata</p></div>
            <div className="px-4 py-2.5">
              <KeyValue k="Project ID" v={project.id} />
              <KeyValue k="Infrastructure type" v={project.infraType} />
              <KeyValue k="Region" v={project.region} />
              <KeyValue k="Status" v={project.status} />
              <KeyValue k="Risk level" v={project.riskLevel} />
              <KeyValue k="Featured" v={project.featured ? "Yes" : "No"} />
            </div>
          </section>

          <section className="card" aria-label="Quick actions">
            <div className="card-header"><p className="card-title">Workflow</p></div>
            <div className="flex flex-col gap-2 p-4">
              <button type="button" className="btn btn-secondary justify-start" onClick={runAnalysis}>
                <Sparkles size={13.5} aria-hidden /> Run planning analysis
              </button>
              <Link href="/twin" className="btn btn-secondary justify-start">
                <GitCompareArrows size={13.5} aria-hidden /> Open in Digital Twin
              </Link>
              <Link href="/graph" className="btn btn-secondary justify-start">
                <FileText size={13.5} aria-hidden /> Trace dependencies
              </Link>
              <p className="mt-1 text-[10.5px] leading-4 text-faint">
                Analysis handoff loads this project&apos;s requirements into the Planning Studio automatically.
              </p>
            </div>
          </section>
        </div>
      </div>

      <ProjectEditModal project={project} open={editOpen} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        busy={busy}
        title="Delete project"
        body={`Permanently delete “${project.name}” (${project.id}) and its ${relatedReports.length} saved report(s)? This cannot be undone.`}
        confirmLabel="Delete permanently"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10.5px] text-muted">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold text-ink">{value}</p>
    </div>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense>
      <DetailInner />
    </Suspense>
  );
}
