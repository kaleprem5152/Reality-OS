"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { INFRA_TYPES, SUSTAINABILITY_OPTIONS } from "@/lib/data/seed";
import { cx } from "@/lib/format";

interface Draft {
  name: string;
  description: string;
  infraType: string;
  region: string;
  capacityTarget: string;
  budgetInput: string;
  currency: "INR_CR" | "USD_M";
  targetCompletion: string;
  sustainabilityPriorities: string[];
  requirements: string;
}

const EMPTY: Draft = {
  name: "",
  description: "",
  infraType: "",
  region: "",
  capacityTarget: "",
  budgetInput: "",
  currency: "INR_CR",
  targetCompletion: "",
  sustainabilityPriorities: [],
  requirements: "",
};

const YEARS = Array.from({ length: 15 }, (_, i) => String(2026 + i));

export function toCrore(input: string, currency: "INR_CR" | "USD_M"): number {
  const v = Number(input);
  if (!Number.isFinite(v)) return NaN;
  // Illustrative FX: $1M ≈ ₹8.3 crore
  return currency === "INR_CR" ? v : Math.round(v * 8.3 * 10) / 10;
}

export function ProjectWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { createProject } = useApp();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const budgetCrore = useMemo(() => toCrore(draft.budgetInput, draft.currency), [draft]);

  const close = useCallback(() => {
    if (busy) return;
    onClose();
    setStep(1);
    setErrors({});
    setApiError(null);
  }, [busy, onClose]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setErrors((e) => {
      const n = { ...e };
      delete n[k];
      delete n.budgetInput;
      return n;
    });
  };

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (draft.name.trim().length < 3) e.name = "Enter a project name (at least 3 characters).";
      if (!draft.infraType) e.infraType = "Select an infrastructure type.";
      if (draft.region.trim().length < 2) e.region = "Enter the geographic region.";
    }
    if (s === 2) {
      if (!draft.budgetInput.trim()) e.budgetInput = "Enter the estimated budget.";
      else if (!Number.isFinite(Number(draft.budgetInput)) || Number(draft.budgetInput) <= 0)
        e.budgetInput = "Budget must be a positive number.";
      else if (budgetCrore > 500000) e.budgetInput = "Budget looks unreasonably large (max ₹500,000 cr).";
      if (!draft.targetCompletion) e.targetCompletion = "Select a target completion year.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setBusy(true);
    setApiError(null);
    try {
      const created = await createProject({
        name: draft.name.trim(),
        description: draft.description.trim(),
        infraType: draft.infraType,
        region: draft.region.trim(),
        status: "Planning",
        budgetCrore,
        targetCompletion: draft.targetCompletion,
        riskLevel: "Moderate",
        capacityTarget: draft.capacityTarget.trim(),
        sustainabilityPriorities: draft.sustainabilityPriorities,
        requirements: draft.requirements.trim(),
      });
      setBusy(false);
      setDraft(EMPTY);
      setStep(1);
      onClose();
      router.push(`/projects/${created.id}?created=1`);
    } catch (err) {
      setBusy(false);
      setApiError(err instanceof Error ? err.message : "Failed to create project");
    }
  };

  const togglePrio = (p: string) =>
    set(
      "sustainabilityPriorities",
      draft.sustainabilityPriorities.includes(p)
        ? draft.sustainabilityPriorities.filter((x) => x !== p)
        : [...draft.sustainabilityPriorities, p],
    );

  return (
    <Modal open={open} onClose={close} title="Create project" subtitle="Three-step setup — fields marked * are required" width={620}>
      {/* Stepper */}
      <ol className="mb-5 flex items-center gap-2" aria-label="Wizard progress">
        {["Project details", "Planning parameters", "Review & create"].map((label, i) => {
          const n = i + 1;
          const done = step > n;
          const current = step === n;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cx(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                  done && "border-success bg-success text-[#0A0B0D]",
                  current && "border-primary bg-primary text-[#0A0B0D]",
                  !done && !current && "border-line bg-app-bg text-muted",
                )}
                aria-current={current ? "step" : undefined}
              >
                {done ? <Check size={12} aria-hidden /> : n}
              </span>
              <span className={cx("hidden text-[11.5px] sm:block", current ? "font-semibold text-ink" : "text-muted")}>{label}</span>
              {n < 3 && <span className="h-px flex-1 bg-line" aria-hidden />}
            </li>
          );
        })}
      </ol>

      {apiError && (
        <div className="mb-4 rounded-md border border-[#4D2727] bg-critical-soft px-3 py-2 text-[12px] text-critical" role="alert">
          {apiError}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 anim-fade">
          <div>
            <label className="label" htmlFor="w-name">Project name *</label>
            <input id="w-name" className={cx("input", errors.name && "input-error")} value={draft.name}
              onChange={(e) => set("name", e.target.value)} placeholder="e.g. Coastal Metro Extension Phase 2" />
            {errors.name && <p className="field-error" role="alert">{errors.name}</p>}
          </div>
          <div>
            <label className="label" htmlFor="w-desc">Description</label>
            <textarea id="w-desc" className="textarea" value={draft.description}
              onChange={(e) => set("description", e.target.value)} placeholder="Short description of scope and intent" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="w-type">Infrastructure type *</label>
              <select id="w-type" className={cx("select", errors.infraType && "input-error")} value={draft.infraType}
                onChange={(e) => set("infraType", e.target.value)}>
                <option value="">Select type…</option>
                {INFRA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.infraType && <p className="field-error" role="alert">{errors.infraType}</p>}
            </div>
            <div>
              <label className="label" htmlFor="w-region">Geographic region *</label>
              <input id="w-region" className={cx("input", errors.region && "input-error")} value={draft.region}
                onChange={(e) => set("region", e.target.value)} placeholder="e.g. Northern Metro Region" />
              {errors.region && <p className="field-error" role="alert">{errors.region}</p>}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 anim-fade">
          <div>
            <label className="label" htmlFor="w-cap">Population or capacity target</label>
            <input id="w-cap" className="input" value={draft.capacityTarget}
              onChange={(e) => set("capacityTarget", e.target.value)} placeholder="e.g. 250,000 daily passengers by opening year" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="w-budget">Estimated budget *</label>
              <input id="w-budget" inputMode="decimal" className={cx("input", errors.budgetInput && "input-error")}
                value={draft.budgetInput} onChange={(e) => set("budgetInput", e.target.value)}
                placeholder={draft.currency === "INR_CR" ? "e.g. 8500" : "e.g. 1000"} />
              {errors.budgetInput && <p className="field-error" role="alert">{errors.budgetInput}</p>}
            </div>
            <div>
              <label className="label" htmlFor="w-cur">Currency</label>
              <select id="w-cur" className="select" value={draft.currency}
                onChange={(e) => set("currency", e.target.value as Draft["currency"])}>
                <option value="INR_CR">₹ crore (INR)</option>
                <option value="USD_M">$ million (USD)</option>
              </select>
            </div>
          </div>
          {draft.currency === "USD_M" && Number(draft.budgetInput) > 0 && (
            <p className="text-[11px] text-muted">
              Stored as ≈ ₹{budgetCrore.toLocaleString("en-IN")} crore at the illustrative rate $1M ≈ ₹8.3 cr.
            </p>
          )}
          <div>
            <label className="label" htmlFor="w-year">Target completion year *</label>
            <select id="w-year" className={cx("select", errors.targetCompletion && "input-error")} value={draft.targetCompletion}
              onChange={(e) => set("targetCompletion", e.target.value)}>
              <option value="">Select year…</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {errors.targetCompletion && <p className="field-error" role="alert">{errors.targetCompletion}</p>}
          </div>
          <fieldset>
            <legend className="label">Sustainability priorities</legend>
            <div className="flex flex-wrap gap-1.5">
              {SUSTAINABILITY_OPTIONS.map((p) => {
                const on = draft.sustainabilityPriorities.includes(p);
                return (
                  <button key={p} type="button" onClick={() => togglePrio(p)} aria-pressed={on}
                    className={cx("rounded border px-2.5 py-1.5 text-[11.5px] transition-colors",
                      on ? "border-[#3A404B] bg-primary-soft font-medium text-primary-hover" : "border-line bg-surface text-muted hover:text-ink")}>
                    {p}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div>
            <label className="label" htmlFor="w-req">Additional requirements</label>
            <textarea id="w-req" className="textarea" value={draft.requirements}
              onChange={(e) => set("requirements", e.target.value)} placeholder="Requirements brief used by the AI Planning Studio" />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="anim-fade">
          <dl className="divide-y divide-line rounded-md border border-line">
            <ReviewRow k="Name" v={draft.name} />
            <ReviewRow k="Type / Region" v={`${draft.infraType} — ${draft.region}`} />
            <ReviewRow k="Budget" v={`₹${budgetCrore.toLocaleString("en-IN")} crore${draft.currency === "USD_M" ? ` (from $${draft.budgetInput}M)` : ""}`} />
            <ReviewRow k="Target completion" v={draft.targetCompletion} />
            <ReviewRow k="Capacity target" v={draft.capacityTarget || "—"} />
            <ReviewRow k="Sustainability" v={draft.sustainabilityPriorities.join(", ") || "None selected"} />
            <ReviewRow k="Requirements" v={draft.requirements ? draft.requirements.slice(0, 160) + (draft.requirements.length > 160 ? "…" : "") : "—"} />
          </dl>
          <p className="mt-3 text-[11px] leading-4.5 text-muted">
            The project is created with status “Planning” and Moderate risk, persisted to the workspace database, and immediately searchable.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <button type="button" className="btn btn-ghost" onClick={() => (step === 1 ? close() : setStep(step - 1))} disabled={busy}>
          <ArrowLeft size={13} aria-hidden /> {step === 1 ? "Cancel" : "Back"}
        </button>
        {step < 3 ? (
          <button type="button" className="btn btn-primary" onClick={() => validateStep(step) && setStep(step + 1)}>
            Continue <ArrowRight size={13} aria-hidden />
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Check size={13} aria-hidden />}
            {busy ? "Creating…" : "Create project"}
          </button>
        )}
      </div>
    </Modal>
  );
}

function ReviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-4 px-3.5 py-2.5">
      <dt className="w-36 shrink-0 text-[11.5px] font-medium text-muted">{k}</dt>
      <dd className="text-[12px] leading-5 text-ink">{v}</dd>
    </div>
  );
}
