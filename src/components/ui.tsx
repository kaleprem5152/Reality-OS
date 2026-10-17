"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, Loader2, type LucideIcon } from "lucide-react";
import { cx } from "@/lib/format";
import type { RiskLevel } from "@/lib/types";

/* --------------------------------- Spinner -------------------------------- */

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <Loader2 size={14} className="animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="card flex items-center justify-center gap-3 p-10 text-sm text-muted">
      <Loader2 size={16} className="animate-spin" aria-hidden />
      {label}
    </div>
  );
}

/* -------------------------------- EmptyState ------------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="rounded-md border border-line bg-app-bg p-2.5 text-faint">
        <Icon size={20} aria-hidden />
      </div>
      <p className="text-[13.5px] font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-xs leading-5 text-muted">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------- Modal ---------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.activeElement as HTMLElement | null;
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus(), 30);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(0,0,0,0.6)] p-4 pt-[7vh] anim-fade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div ref={ref} className="anim-pop w-full rounded-lg border border-line bg-surface shadow-pop" style={{ maxWidth: width }}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
          </div>
          <button type="button" className="btn-ghost btn btn-sm -mr-1" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirm",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel?: string;
  busy?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={440}>
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-critical-soft p-2 text-critical">
          <AlertTriangle size={16} aria-hidden />
        </div>
        <p className="text-[13px] leading-6 text-ink-2">{body}</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* --------------------------------- Tooltip --------------------------------- */

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-40 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-[#353A42] bg-[#F2F3F5] px-2 py-1 text-[11px] font-medium text-[#0A0B0D] opacity-0 shadow-pop transition-opacity duration-100 group-hover:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

/* ---------------------------------- Tags ----------------------------------- */

export function RiskTag({ level }: { level: RiskLevel | string }) {
  const cls =
    level === "Low" ? "tag-success" : level === "Moderate" ? "tag-primary" : level === "High" ? "tag-warning" : "tag-critical";
  return <span className={cx("tag", cls)}>{level} risk</span>;
}

export function StatusTag({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Scenario Evaluation": "tag-primary",
    Planning: "tag-neutral",
    "In Review": "tag-warning",
    Approved: "tag-success",
    "In Delivery": "tag-success",
    "On Hold": "tag-critical",
    Archived: "tag-neutral",
    Draft: "tag-neutral",
    Final: "tag-success",
    Proposed: "tag-primary",
    "Under study": "tag-warning",
  };
  return <span className={cx("tag", map[status] ?? "tag-neutral")}>{status}</span>;
}

/* --------------------------------- Banner ---------------------------------- */

export function DemoBanner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#4A3B1E] bg-warning-soft px-3 py-2 text-[11.5px] text-warning">
      <AlertTriangle size={13} aria-hidden />
      <span>{text}</span>
    </div>
  );
}

/* ------------------------------ Section header ------------------------------ */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* --------------------------------- Stat bits -------------------------------- */

export function KeyValue({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-b-0">
      <span className="text-xs text-muted">{k}</span>
      <span className="text-[12.5px] font-medium text-ink">{v}</span>
    </div>
  );
}
