"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpRight,
  ArchiveRestore,
  FilePlus2,
  PencilLine,
  RotateCcw,
  Search,
  SearchX,
  FolderKanban,
  Trash2,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { ProjectWizard } from "@/components/projects/ProjectWizard";
import { ProjectEditModal } from "@/components/projects/ProjectEditModal";
import { ConfirmDialog, EmptyState, PageHeader, RiskTag, StatusTag, Tooltip } from "@/components/ui";
import { INFRA_TYPES, PROJECT_STATUSES } from "@/lib/data/seed";
import { cx, formatCrore } from "@/lib/format";
import type { Project } from "@/lib/types";

type SortKey = "name" | "id" | "infraType" | "region" | "status" | "budgetCrore" | "targetCompletion" | "riskLevel";

const RISK_ORDER = { Low: 0, Moderate: 1, High: 2, Critical: 3 } as const;
const STATUS_ORDER = PROJECT_STATUSES;

function ProjectsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { projects, updateProject, deleteProject, settings } = useApp();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [wizardOpen, setWizardOpen] = useState(() => params.get("new") === "1");
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);

  const [prevParamNew, setPrevParamNew] = useState(() => params.get("new"));
  if (params.get("new") !== prevParamNew) {
    setPrevParamNew(params.get("new"));
    if (params.get("new") === "1") {
      setWizardOpen(true);
    }
  }

  const filtered = useMemo(() => {
    let rows = projects.filter((p) => (showArchived ? true : !p.archived));
    const q = query.trim().toLowerCase();
    if (q)
      rows = rows.filter((p) =>
        `${p.name} ${p.id} ${p.region} ${p.infraType}`.toLowerCase().includes(q),
      );
    if (statusFilter !== "All") rows = rows.filter((p) => p.status === statusFilter);
    if (typeFilter !== "All") rows = rows.filter((p) => p.infraType === typeFilter);
    const cmp = (a: Project, b: Project): number => {
      switch (sortKey) {
        case "budgetCrore":
          return a.budgetCrore - b.budgetCrore;
        case "riskLevel":
          return RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
        case "status":
          return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
        default:
          return String(a[sortKey]).localeCompare(String(b[sortKey]));
      }
    };
    return [...rows].sort((a, b) => cmp(a, b) * sortDir);
  }, [projects, query, statusFilter, typeFilter, showArchived, sortKey, sortDir]);

  const hasFilters = query.trim() !== "" || statusFilter !== "All" || typeFilter !== "All" || showArchived;

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("All");
    setTypeFilter("All");
    setShowArchived(false);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const archive = async (p: Project, archived: boolean) => {
    await updateProject(p.id, { archived });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteProject(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Projects"
        subtitle="Infrastructure project register — search, filter, create, and maintain the portfolio."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setWizardOpen(true)}>
            <FilePlus2 size={14} aria-hidden /> New Project
          </button>
        }
      />

      {/* Toolbar */}
      <div className="card mb-3 flex flex-wrap items-center gap-2.5 px-4 py-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <input
            className="input pl-8"
            placeholder="Search by name, ID, region, or type…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search projects"
          />
        </div>
        <select className="select w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="All">All statuses</option>
          {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by infrastructure type">
          <option value="All">All types</option>
          {INFRA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#F2F3F5]"
          />
          Include archived
        </label>
        {hasFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
            <RotateCcw size={12} aria-hidden /> Reset filters
          </button>
        )}
        <span className="ml-auto text-[11.5px] text-muted">
          {filtered.length} of {projects.length} projects
        </span>
      </div>

      {/* Register table */}
      <div className="card">
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            body="Create your first infrastructure project to begin planning. Seed projects load automatically when the workspace starts."
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setWizardOpen(true)}>
                <FilePlus2 size={13} aria-hidden /> Create project
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No projects match the current filters"
            body={`Nothing matches “${query}” with the selected filters. Adjust the search or reset all filters.`}
            action={
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters}>
                <RotateCcw size={12} aria-hidden /> Reset filters
              </button>
            }
          />
        ) : (
          <div className={cx("table-wrap", settings.compactTables && "tbl-compact")}>
            <table className="tbl">
              <thead>
                <tr>
                  <Th label="Project" col="name" sortKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="ID" col="id" sortKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="Type" col="infraType" sortKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="Region" col="region" sortKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="Status" col="status" sortKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="Est. budget" col="budgetCrore" sortKey={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                  <Th label="Target" col="targetCompletion" sortKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="Risk" col="riskLevel" sortKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="w-28"><span className="sr-only">Row actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className={cx("cursor-pointer", p.archived && "opacity-55")}
                    onClick={() => router.push(`/projects/${p.id}`)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") router.push(`/projects/${p.id}`);
                    }}
                    aria-label={`Open ${p.name}`}
                  >
                    <td>
                      <span className="block max-w-[260px] truncate font-medium text-ink">{p.name}</span>
                      {p.featured && <span className="tag tag-primary mt-1">Featured</span>}
                    </td>
                    <td className="font-mono text-[11.5px] text-muted">{p.id}</td>
                    <td>{p.infraType}</td>
                    <td>{p.region}</td>
                    <td><StatusTag status={p.status} /></td>
                    <td className="text-right font-medium text-ink">{formatCrore(p.budgetCrore, settings.currency)}</td>
                    <td>{p.targetCompletion}</td>
                    <td><RiskTag level={p.riskLevel} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <Tooltip label="Open">
                          <button type="button" className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-app-bg hover:text-ink"
                            onClick={() => router.push(`/projects/${p.id}`)} aria-label={`Open ${p.name}`}>
                            <ArrowUpRight size={14} aria-hidden />
                          </button>
                        </Tooltip>
                        <Tooltip label="Edit">
                          <button type="button" className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-app-bg hover:text-ink"
                            onClick={() => setEditTarget(p)} aria-label={`Edit ${p.name}`}>
                            <PencilLine size={14} aria-hidden />
                          </button>
                        </Tooltip>
                        {p.archived ? (
                          <Tooltip label="Restore">
                            <button type="button" className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-app-bg hover:text-success"
                              onClick={() => void archive(p, false)} aria-label={`Restore ${p.name}`}>
                              <ArchiveRestore size={14} aria-hidden />
                            </button>
                          </Tooltip>
                        ) : (
                          <Tooltip label="Archive">
                            <button type="button" className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-app-bg hover:text-ink"
                              onClick={() => void archive(p, true)} aria-label={`Archive ${p.name}`}>
                              <Archive size={14} aria-hidden />
                            </button>
                          </Tooltip>
                        )}
                        <Tooltip label="Delete">
                          <button type="button" className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-critical-soft hover:text-critical"
                            onClick={() => setDeleteTarget(p)} aria-label={`Delete ${p.name}`}>
                            <Trash2 size={14} aria-hidden />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProjectWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <ProjectEditModal project={editTarget} open={editTarget !== null} onClose={() => setEditTarget(null)} />
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title="Delete project"
        body={`Permanently delete “${deleteTarget?.name}” (${deleteTarget?.id}) and its saved reports? This cannot be undone.`}
        confirmLabel="Delete permanently"
      />
    </div>
  );
}

function Th({
  label, col, sortKey, dir, onSort, className,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  dir: 1 | -1;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === col;
  return (
    <th className={className} aria-sort={active ? (dir === 1 ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cx("inline-flex items-center gap-1 uppercase tracking-wide transition-colors", active ? "text-primary" : "hover:text-ink")}
      >
        {label}
        {active ? (
          <ArrowDownWideNarrow size={11} className={cx(dir === -1 && "rotate-180")} aria-hidden />
        ) : (
          <ArrowUpDown size={11} className="opacity-40" aria-hidden />
        )}
      </button>
    </th>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsInner />
    </Suspense>
  );
}
