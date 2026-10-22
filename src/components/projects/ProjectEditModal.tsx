"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { INFRA_TYPES, PROJECT_STATUSES } from "@/lib/data/seed";
import { cx } from "@/lib/format";
import type { Project } from "@/lib/types";

const RISK_LEVELS = ["Low", "Moderate", "High", "Critical"];

export function ProjectEditModal({
  project,
  open,
  onClose,
}: {
  project: Project | null;
  open: boolean;
  onClose: () => void;
}) {
  const { updateProject } = useApp();
  const [form, setForm] = useState({
    name: "",
    description: "",
    infraType: "",
    region: "",
    status: "",
    riskLevel: "",
    budget: "",
    targetCompletion: "",
    capacityTarget: "",
    requirements: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [prevId, setPrevId] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(false);

  if (project && (project.id !== prevId || (open && !prevOpen))) {
    setPrevId(project.id);
    setPrevOpen(open);
    if (open) {
      setForm({
        name: project.name,
        description: project.description,
        infraType: project.infraType,
        region: project.region,
        status: project.status,
        riskLevel: project.riskLevel,
        budget: String(project.budgetCrore),
        targetCompletion: project.targetCompletion,
        capacityTarget: project.capacityTarget,
        requirements: project.requirements,
      });
      setErrors({});
      setApiError(null);
    }
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  if (!project) return null;

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      const n = { ...e };
      delete n[k];
      return n;
    });
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 3) e.name = "Enter a project name (at least 3 characters).";
    const b = Number(form.budget);
    if (!Number.isFinite(b) || b <= 0) e.budget = "Budget must be a positive number (₹ crore).";
    if (!form.targetCompletion.trim()) e.targetCompletion = "Target completion is required.";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setBusy(true);
    setApiError(null);
    try {
      await updateProject(project.id, {
        name: form.name.trim(),
        description: form.description,
        infraType: form.infraType,
        region: form.region.trim(),
        status: form.status,
        riskLevel: form.riskLevel,
        budgetCrore: b,
        targetCompletion: form.targetCompletion.trim(),
        capacityTarget: form.capacityTarget,
        requirements: form.requirements,
      });
      setBusy(false);
      onClose();
    } catch (err) {
      setBusy(false);
      setApiError(err instanceof Error ? err.message : "Failed to save changes");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${project.id}`} subtitle={project.name} width={600}>
      {apiError && (
        <div className="mb-4 rounded-md border border-[#4D2727] bg-critical-soft px-3 py-2 text-[12px] text-critical" role="alert">
          {apiError}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="e-name">Project name *</label>
          <input id="e-name" className={cx("input", errors.name && "input-error")} value={form.name} onChange={(e) => set("name", e.target.value)} />
          {errors.name && <p className="field-error" role="alert">{errors.name}</p>}
        </div>
        <div>
          <label className="label" htmlFor="e-desc">Description</label>
          <textarea id="e-desc" className="textarea" value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="e-type">Infrastructure type</label>
            <select id="e-type" className="select" value={form.infraType} onChange={(e) => set("infraType", e.target.value)}>
              {INFRA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="e-region">Region</label>
            <input id="e-region" className="input" value={form.region} onChange={(e) => set("region", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="e-status">Status</label>
            <select id="e-status" className="select" value={form.status} onChange={(e) => set("status", e.target.value)}>
              {PROJECT_STATUSES.filter((s) => s !== "Archived").map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="e-risk">Risk level</label>
            <select id="e-risk" className="select" value={form.riskLevel} onChange={(e) => set("riskLevel", e.target.value)}>
              {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="e-budget">Budget (₹ crore) *</label>
            <input id="e-budget" inputMode="decimal" className={cx("input", errors.budget && "input-error")} value={form.budget} onChange={(e) => set("budget", e.target.value)} />
            {errors.budget && <p className="field-error" role="alert">{errors.budget}</p>}
          </div>
          <div>
            <label className="label" htmlFor="e-target">Target completion *</label>
            <input id="e-target" className={cx("input", errors.targetCompletion && "input-error")} value={form.targetCompletion} onChange={(e) => set("targetCompletion", e.target.value)} />
            {errors.targetCompletion && <p className="field-error" role="alert">{errors.targetCompletion}</p>}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="e-cap">Capacity target</label>
          <input id="e-cap" className="input" value={form.capacityTarget} onChange={(e) => set("capacityTarget", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="e-req">Requirements brief</label>
          <textarea id="e-req" className="textarea" value={form.requirements} onChange={(e) => set("requirements", e.target.value)} />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
          {busy && <Loader2 size={13} className="animate-spin" aria-hidden />}
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}
