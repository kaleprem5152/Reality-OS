"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Compass, Layers, ShieldCheck, TrainFront } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

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

  const handleComplete = () => {
    router.push("/overview");
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
          Configure your primary infrastructure focus for {user?.organization || "your authority"}.
        </p>
      </div>

      <div className="space-y-2.5 mb-6">
        {FOCUS_AREAS.map((f) => {
          const active = selectedFocus === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedFocus(f.id)}
              className={`flex w-full items-start gap-3 rounded-lg border p-3.5 text-left transition-all ${
                active
                  ? "border-primary bg-primary/10 text-[#F2F3F5]"
                  : "border-[#23262C] bg-[#14171C] text-[#8A909A] hover:border-[#353945] hover:text-[#C4C9D0]"
              }`}
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

      <div className="rounded-md border border-[#23262C] bg-[#14171C] p-3 text-[11.5px] text-[#8A909A] mb-6 flex items-start gap-2.5">
        <ShieldCheck size={16} className="shrink-0 text-[#7CD4AE] mt-0.5" />
        <span>
          Your workspace comes preloaded with the 42-station Metro Intelligence demonstration alignment, digital twin parameters, and 5 coordinated AI planning agents.
        </span>
      </div>

      <button
        type="button"
        onClick={handleComplete}
        className="group flex w-full items-center justify-center gap-2 rounded-md bg-[#F2F3F5] py-2.5 text-[13px] font-semibold text-[#0A0B0D] transition-colors hover:bg-[#D8DBE0]"
      >
        Launch Command Center
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}
