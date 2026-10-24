"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Compass, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { api } from "@/lib/api-client";

const FOCUS_AREAS = [
  { id: "rail", title: "Metropolitan Transit & Rail", desc: "Corridor routing, station catchment, headway & fleet scenarios" },
  { id: "highways", title: "Highways & Arterial Corridors", desc: "Access-controlled bypasses, interchanges, freight bottlenecks" },
  { id: "energy", title: "Clean Power & Grid Modernization", desc: "Substation load planning, transmission corridors, renewable integration" },
  { id: "water", title: "Water Grids & Flood Resilience", desc: "Trunk pipe rehabilitation, non-revenue water mitigation, catchment monitoring" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedFocus, setSelectedFocus] = useState("rail");
  const [workspaceName, setWorkspaceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultPlaceholder = user?.organization
    ? `${user.organization} Workspace`
    : "Metropolitan Infrastructure Authority";

  const handleComplete = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const chosenFocus = FOCUS_AREAS.find((f) => f.id === selectedFocus)?.title || "Metropolitan Transit & Rail";
      const finalName =
        workspaceName.trim() || `${user?.organization || "Metropolitan"} ${chosenFocus} Workspace`;

      await api.createWorkspace(finalName);
      router.push("/overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set up workspace. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#23262C] bg-[#0E1013] p-7 shadow-2xl">
      <div className="mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
          <Compass size={12} /> Workspace Setup
        </span>
        <h1 className="mt-3 text-[20px] font-semibold tracking-tight text-[#F2F3F5]">
          Welcome, {user?.fullName || "Infrastructure Planner"}
        </h1>
        <p className="mt-1 text-[13px] text-[#8A909A]">
          Configure your primary infrastructure focus and establish your organization&apos;s workspace.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-[#F87171]/20 bg-[#F87171]/10 p-3 text-[12px] text-[#F87171]">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Focus Area Selection */}
      <div className="space-y-2.5 mb-5">
        <label className="block text-[12px] font-medium text-[#C4C9D0]">
          Primary Planning Discipline
        </label>
        {FOCUS_AREAS.map((f) => {
          const active = selectedFocus === f.id;
          return (
            <button
              key={f.id}
              type="button"
              disabled={busy}
              onClick={() => setSelectedFocus(f.id)}
              className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                active
                  ? "border-primary bg-primary/10 text-[#F2F3F5]"
                  : "border-[#23262C] bg-[#14171C] text-[#8A909A] hover:border-[#353945] hover:text-[#C4C9D0]"
              } disabled:opacity-50`}
            >
              <div className="mt-0.5">
                {active ? (
                  <CheckCircle2 size={16} className="text-primary" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-[#353945]" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-[#F2F3F5]">{f.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#8A909A]">{f.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Workspace Name Input */}
      <div className="mb-5">
        <label className="mb-1.5 block text-[12px] font-medium text-[#C4C9D0]" htmlFor="workspace-name">
          Workspace Name
        </label>
        <input
          id="workspace-name"
          type="text"
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          placeholder={defaultPlaceholder}
          disabled={busy}
          className="w-full rounded-md border border-[#23262C] bg-[#0A0B0D] py-2 px-3 text-[13px] text-[#F2F3F5] placeholder-[#626975] outline-none transition-colors focus:border-primary disabled:opacity-50"
        />
        <p className="mt-1 text-[11px] text-[#8A909A]">
          Leave blank to use the recommended authority name.
        </p>
      </div>

      <div className="rounded-md border border-[#23262C] bg-[#14171C] p-3 text-[11.5px] text-[#8A909A] mb-6 flex items-start gap-2.5">
        <ShieldCheck size={16} className="shrink-0 text-[#7CD4AE] mt-0.5" />
        <span>
          Your workspace comes preloaded with the 42-station Metro Intelligence demonstration alignment, digital twin parameters, and 5 coordinated AI planning agents.
        </span>
      </div>

      <button
        type="button"
        onClick={handleComplete}
        disabled={busy}
        className="group flex w-full items-center justify-center gap-2 rounded-md bg-[#F2F3F5] py-2.5 text-[13px] font-semibold text-[#0A0B0D] transition-colors hover:bg-[#D8DBE0] disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden />
            <span>Establishing Workspace…</span>
          </>
        ) : (
          <>
            <span>Launch Command Center</span>
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </div>
  );
}
