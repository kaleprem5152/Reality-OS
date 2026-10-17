"use client";

import { useEffect, useState } from "react";
import { Bot, CheckCircle2, RotateCcw } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { PageHeader } from "@/components/ui";
import { DEFAULT_SETTINGS } from "@/lib/settings-service";
import { INPUT_BOUNDS } from "@/lib/simulation";
import { cx } from "@/lib/format";

export default function SettingsPage() {
  const { settings, updateSettings } = useApp();
  const [ai, setAi] = useState<{ configured: boolean; provider: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then(setAi)
      .catch(() => setAi({ configured: false, provider: null }));
  }, []);

  return (
    <div className="mx-auto max-w-[880px]">
      <PageHeader
        title="Settings"
        subtitle="Workspace preferences that change real application behavior. No decorative toggles."
      />

      <div className="space-y-4">
        {/* Display */}
        <section className="card" aria-label="Display preferences">
          <div className="card-header">
            <div>
              <p className="card-title">Workspace display</p>
              <p className="card-sub mt-0.5">Applies across every page</p>
            </div>
          </div>
          <div className="divide-y divide-line">
            <SettingRow
              label="Currency for figures"
              desc="Formats all monetary values. USD uses an illustrative conversion (₹1 cr ≈ $0.12M)."
            >
              <select className="select w-auto" value={settings.currency}
                onChange={(e) => updateSettings({ currency: e.target.value as "INR" | "USD" })} aria-label="Default currency">
                <option value="INR">₹ INR crore</option>
                <option value="USD">$ USD (illustrative)</option>
              </select>
            </SettingRow>
            <SettingRow label="Compact tables" desc="Tighter row density in registers and comparison tables.">
              <Toggle on={settings.compactTables} onChange={(v) => updateSettings({ compactTables: v })} label="Compact tables" />
            </SettingRow>
          </div>
        </section>

        {/* Simulation defaults */}
        <section className="card" aria-label="Simulation defaults">
          <div className="card-header">
            <div>
              <p className="card-title">Simulation defaults</p>
              <p className="card-sub mt-0.5">Seeds the Digital Twin baseline scenario on first load</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateSettings({
              defaultStations: DEFAULT_SETTINGS.defaultStations,
              defaultCorridorKm: DEFAULT_SETTINGS.defaultCorridorKm,
              defaultBudgetCrore: DEFAULT_SETTINGS.defaultBudgetCrore,
              defaultYears: DEFAULT_SETTINGS.defaultYears,
            })}>
              <RotateCcw size={12} aria-hidden /> Reset defaults
            </button>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <NumSetting label="Default stations" value={settings.defaultStations} bounds={INPUT_BOUNDS.stations}
              onChange={(v) => updateSettings({ defaultStations: v })} />
            <NumSetting label="Default corridor (km)" value={settings.defaultCorridorKm} bounds={INPUT_BOUNDS.corridorKm}
              onChange={(v) => updateSettings({ defaultCorridorKm: v })} />
            <NumSetting label="Default budget (₹ crore)" value={settings.defaultBudgetCrore} bounds={INPUT_BOUNDS.budgetCrore}
              onChange={(v) => updateSettings({ defaultBudgetCrore: v })} />
            <NumSetting label="Default duration (years)" value={settings.defaultYears} bounds={INPUT_BOUNDS.constructionYears}
              onChange={(v) => updateSettings({ defaultYears: v })} step={0.5} />
          </div>
        </section>

        {/* Map preferences */}
        <section className="card" aria-label="Map preferences">
          <div className="card-header">
            <div>
              <p className="card-title">Map display</p>
              <p className="card-sub mt-0.5">Initial state of the Geo Intelligence map</p>
            </div>
          </div>
          <div className="divide-y divide-line">
            <SettingRow label="Default base map" desc="Initial tile provider; can be changed live on the Geo page.">
              <select className="select w-auto" value={settings.mapDefaultLayer}
                onChange={(e) => updateSettings({ mapDefaultLayer: e.target.value as "streets" | "light" })} aria-label="Default base map">
                <option value="light">CARTO dark (mono)</option>
                <option value="streets">OpenStreetMap standard</option>
              </select>
            </SettingRow>
            <SettingRow label="Hover labels" desc="Show station tooltips on hover by default.">
              <Toggle on={settings.mapShowLabels} onChange={(v) => updateSettings({ mapShowLabels: v })} label="Hover labels" />
            </SettingRow>
          </div>
        </section>

        {/* AI configuration */}
        <section className="card" aria-label="AI provider configuration">
          <div className="card-header">
            <div>
              <p className="card-title">AI provider configuration</p>
              <p className="card-sub mt-0.5">Server-side integration status — read-only in the browser</p>
            </div>
          </div>
          <div className="p-4">
            <div
              className={cx(
                "flex items-start gap-3 rounded-md border px-4 py-3",
                ai?.configured ? "border-[#1F4A3C] bg-success-soft" : "border-[#4A3B1E] bg-warning-soft",
              )}
              role="status"
            >
              <Bot size={16} className={cx("mt-0.5 shrink-0", ai?.configured ? "text-success" : "text-warning")} aria-hidden />
              <div className="text-[12px] leading-5">
                {ai === null ? (
                  <p className="text-muted">Checking server configuration…</p>
                ) : ai.configured ? (
                  <>
                    <p className="flex items-center gap-1.5 font-semibold text-success">
                      <CheckCircle2 size={13} aria-hidden /> Gemini integration configured
                    </p>
                    <p className="mt-1 text-muted">
                      The AI Planning Studio executes genuine server-side Gemini requests. The key never reaches the browser.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-warning">Demo analysis mode</p>
                    <p className="mt-1 text-muted">
                      No <code className="rounded bg-surface px-1 py-0.5 text-[10.5px]">GEMINI_API_KEY</code> is set on the server, so the
                      Studio runs the documented deterministic demo analysis and labels it as such. To enable live mode, set
                      <code className="mx-1 rounded bg-surface px-1 py-0.5 text-[10.5px]">GEMINI_API_KEY</code>
                      as a server environment variable and restart. Keys are never stored in browser storage or shown here.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Data note */}
        <section className="card" aria-label="Data and persistence">
          <div className="card-header"><p className="card-title">Data & persistence</p></div>
          <div className="space-y-2 p-4 text-[12px] leading-5 text-muted">
            <p>
              <span className="font-medium text-ink-2">Projects and reports</span> are persisted in the workspace
              PostgreSQL database and survive reloads. Seed data loads once when the database is empty.
            </p>
            <p>
              <span className="font-medium text-ink-2">Display preferences</span> on this page are stored in browser
              local storage only — they never leave the device and hold no credentials.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3.5">
      <div>
        <p className="text-[12.5px] font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-[11px] leading-4.5 text-muted">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function NumSetting({
  label, value, onChange, bounds, step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  bounds: { min: number; max: number; step: number };
  step?: number;
}) {
  const invalid = !Number.isFinite(value) || value < bounds.min || value > bounds.max;
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className={cx("input", invalid && "input-error")}
        value={Number.isFinite(value) ? value : ""}
        min={bounds.min}
        max={bounds.max}
        step={step ?? bounds.step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <p className={cx("mt-0.5 text-[9.5px]", invalid ? "text-critical" : "text-faint")}>
        {invalid ? `Must be between ${bounds.min.toLocaleString("en-IN")} and ${bounds.max.toLocaleString("en-IN")}` : `Bounds: ${bounds.min.toLocaleString("en-IN")} – ${bounds.max.toLocaleString("en-IN")}`}
      </p>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-line-strong")}
    >
      <span className={cx("absolute top-0.5 h-4 w-4 rounded-full transition-all", on ? "left-[18px] bg-[#0A0B0D]" : "left-0.5 bg-[#F2F3F5]")} aria-hidden />
    </button>
  );
}
