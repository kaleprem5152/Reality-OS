"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  FileText,
  FlaskConical,
  FolderKanban,
  GitCompareArrows,
  LayoutDashboard,
  Map as MapIcon,
  Network,
  Play,
  ScanSearch,
  Settings as SettingsIcon,
  TrainFront,
} from "lucide-react";
import { Globe3D } from "@/components/landing/Globe3D";
import { useAuth } from "@/components/providers/AuthProvider";
import { SEED_PROJECTS } from "@/lib/data/seed";
import { BASELINE_SCENARIO, runScenario } from "@/lib/simulation";
import { cx } from "@/lib/format";

/* ------------------------------ Tiny primitives ----------------------------- */

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          ob.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return (
    <div ref={ref} className={cx("lp-reveal", inView && "in", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function useCountUp(target: number, started: boolean, duration = 1400): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!started) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, target, duration]);
  return v;
}

function useTypewriter(text: string, speed = 42, startDelay = 500): string {
  const [n, setN] = useState(0);
  useEffect(() => {
    let i = 0;
    let iv: ReturnType<typeof setInterval> | undefined;
    const t0 = setTimeout(() => {
      iv = setInterval(() => {
        i += 1;
        setN(i);
        if (i >= text.length && iv) clearInterval(iv);
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(t0);
      if (iv) clearInterval(iv);
    };
  }, [text, speed, startDelay]);
  return text.slice(0, n);
}

function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="5" cy="5" r="2.4" fill="#F2F3F5" />
      <circle cx="17" cy="6" r="2.4" fill="#7CD4AE" />
      <circle cx="11" cy="17" r="2.4" fill="#F2F3F5" />
      <path d="M6.8 6.3 15 6M5.9 7.1l4 8M16 8.2l-3.8 7" stroke="#F2F3F5" strokeWidth="1.3" />
    </svg>
  );
}

/* --------------------------------- Modules --------------------------------- */

const MODULES = [
  { icon: LayoutDashboard, name: "Command Center", desc: "Executive portfolio view with an interactive network schematic and risk posture.", href: "/overview" },
  { icon: FolderKanban, name: "Project Register", desc: "Create, filter, sort and govern eight-plus infrastructure programmes.", href: "/projects" },
  { icon: BrainCircuit, name: "AI Planning Studio", desc: "Five coordinated planning agents turn briefs into explainable reports.", href: "/studio" },
  { icon: MapIcon, name: "Geo Intelligence", desc: "Candidate sites and corridors scored on a live, layered map.", href: "/geo" },
  { icon: GitCompareArrows, name: "Digital Twin", desc: "Deterministic scenario engine with a real seeded Monte Carlo.", href: "/twin" },
  { icon: Network, name: "Knowledge Graph", desc: "Typed dependencies between budgets, utilities, risks and regulations.", href: "/graph" },
  { icon: FileText, name: "Reports & Evidence", desc: "Persisted documents with genuine, readable PDF export.", href: "/reports" },
  { icon: SettingsIcon, name: "Workspace Settings", desc: "Currency, simulation and map defaults that actually change behavior.", href: "/settings" },
];

const WORKFLOW = [
  { n: "01", title: "Describe the brief", body: "Natural-language requirements, objectives and constraints — grounded in a persisted project register, not a blank canvas." },
  { n: "02", title: "Agents analyze", body: "Transport, financial, environmental, utilities and risk agents return structured findings with stated rationale." },
  { n: "03", title: "Simulate trade-offs", body: "A documented deterministic engine compares cost, time, capacity and sustainability — reproducibly, no hidden randomness." },
  { n: "04", title: "Export the evidence", body: "Analyses persist as reports with assumptions and sources labeled, exportable to a readable PDF." },
];

const MARQUEE_ITEMS = [
  "Government infrastructure authorities",
  "Transportation engineers",
  "Urban planners",
  "Financial analysts",
  "Environmental reviewers",
  "Project delivery teams",
];

/* --------------------------------- Landing --------------------------------- */

export function Landing() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [heroIn, setHeroIn] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsOn, setStatsOn] = useState(false);

  const kicker = useTypewriter("INFRASTRUCTURE INTELLIGENCE PLATFORM");

  const portfolio = useMemo(() => SEED_PROJECTS.reduce((s, p) => s + p.budgetCrore, 0), []);
  const scenario = useMemo(() => runScenario(BASELINE_SCENARIO), []);

  const cProjects = useCountUp(SEED_PROJECTS.length, statsOn);
  const cInvestment = useCountUp(portfolio, statsOn);
  const cStations = useCountUp(42, statsOn);
  const cCorridor = useCountUp(68, statsOn);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setHeroIn(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setStatsOn(true);
          ob.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  const onCardMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--gx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    e.currentTarget.style.setProperty("--gy", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#0A0B0D] text-[#F2F3F5]">
      {/* ================================ NAV ================================ */}
      <header
        className={cx(
          "fixed inset-x-0 top-0 z-40 transition-all duration-300",
          scrolled ? "border-b border-[#23262C] bg-[rgba(10,11,13,0.78)] backdrop-blur-md" : "bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-[15px] font-semibold tracking-tight">RealityOS</span>
          </Link>
          <nav className="ml-4 hidden items-center gap-6 text-[13px] text-[#8A909A] md:flex">
            <a href="#platform" className="transition-colors hover:text-[#F2F3F5]">Platform</a>
            <a href="#workflow" className="transition-colors hover:text-[#F2F3F5]">Workflow</a>
            <a href="#engine" className="transition-colors hover:text-[#F2F3F5]">Scenario engine</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-[#23262C] px-2.5 py-1 text-[10.5px] text-[#8A909A] sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7CD4AE]" aria-hidden />
              Prototype · deterministic demo data
            </span>
            {user ? (
              <Link
                href="/overview"
                className="group inline-flex items-center gap-2 rounded-md bg-[#F2F3F5] px-4 py-2 text-[13px] font-semibold text-[#0A0B0D] transition-colors hover:bg-[#D8DBE0]"
              >
                Go to Workspace
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-[13px] font-medium text-[#8A909A] transition-colors hover:text-[#F2F3F5]"
                >
                  Sign in
                </Link>
                <Link
                  href="/login?redirect=/overview"
                  className="group inline-flex items-center gap-2 rounded-md bg-[#F2F3F5] px-4 py-2 text-[13px] font-semibold text-[#0A0B0D] transition-colors hover:bg-[#D8DBE0]"
                >
                  Sign In to Enter
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ================================ HERO ================================ */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden">
        <div className="lp-grid-overlay pointer-events-none absolute inset-0" aria-hidden />
        <Globe3D className="pointer-events-none absolute inset-0 h-full w-full opacity-90" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 75% 60% at 50% 42%, transparent 30%, #0A0B0D 92%)" }}
          aria-hidden
        />

        <div className="relative z-10 mx-auto w-full max-w-[1240px] px-6 pt-24">
          <div className="max-w-[860px]">
            <div
              className={cx("lp-reveal", heroIn && "in")}
              style={{ transitionDelay: "80ms" }}
            >
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#353A42] bg-[rgba(18,20,23,0.6)] px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-[#7CD4AE] backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7CD4AE] lp-float" aria-hidden />
                {kicker}
                <span className="lp-caret text-[#7CD4AE]" aria-hidden>▍</span>
              </p>
            </div>
            <h1
              className={cx("lp-reveal text-[clamp(42px,6.4vw,84px)] font-semibold leading-[1.02] tracking-[-0.03em]", heroIn && "in")}
              style={{ transitionDelay: "180ms" }}
            >
              The cognitive operating system for{" "}
              <span className="relative inline-block">
                <span className="text-[#7CD4AE]">intelligent</span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 220 8" fill="none" aria-hidden>
                  <path d="M2 6C60 2 160 2 218 5" stroke="#7CD4AE" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
                </svg>
              </span>{" "}
              infrastructure.
            </h1>
            <p
              className={cx("lp-reveal mt-6 max-w-[620px] text-[clamp(15px,1.4vw,18px)] leading-8 text-[#8A909A]", heroIn && "in")}
              style={{ transitionDelay: "300ms" }}
            >
              RealityOS turns infrastructure requirements into explainable planning strategy — with coordinating
              AI agents, geographic intelligence, reproducible scenario simulation, and evidence you can export.
            </p>
            <div className={cx("lp-reveal mt-9 flex flex-wrap items-center gap-4", heroIn && "in")} style={{ transitionDelay: "420ms" }}>
              <Link
                href={user ? "/overview" : "/login?redirect=/overview"}
                className="group inline-flex items-center gap-2.5 rounded-lg bg-[#F2F3F5] px-6 py-3.5 text-[15px] font-semibold text-[#0A0B0D] transition-all hover:-translate-y-0.5 hover:bg-[#D8DBE0] hover:shadow-[0_12px_40px_rgba(242,243,245,0.14)]"
              >
                {user ? "Enter the Command Center" : "Sign In to Enter Command Center"}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
              <Link
                href={user ? "/studio" : "/login?redirect=/studio"}
                className="group inline-flex items-center gap-2.5 rounded-lg border border-[#353A42] bg-[rgba(18,20,23,0.55)] px-6 py-3.5 text-[15px] font-medium text-[#F2F3F5] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-[#626975]"
              >
                <Play size={14} className="text-[#7CD4AE]" aria-hidden />
                Run a planning analysis
              </Link>
            </div>

            {/* Stat strip */}
            <div ref={statsRef} className={cx("lp-reveal mt-14 grid max-w-[720px] grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#23262C] bg-[#23262C] sm:grid-cols-4", heroIn && "in")} style={{ transitionDelay: "540ms" }}>
              <HeroStat value={String(cProjects).padStart(2, "0")} label="Active programmes" />
              <HeroStat value={`₹${cInvestment.toLocaleString("en-IN")} cr`} label="Portfolio envelope" />
              <HeroStat value={String(cStations)} label="Stations modeled" />
              <HeroStat value={`${cCorridor} km`} label="Corridor length" />
            </div>
            <p className={cx("lp-reveal mt-3 text-[11px] text-[#626975]", heroIn && "in")} style={{ transitionDelay: "620ms" }}>
              Demo workspace — figures are illustrative, derived live from the same dataset the product uses.
            </p>
          </div>
        </div>

        {/* bottom fade */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#0A0B0D]" aria-hidden />
      </section>

      {/* ============================== MARQUEE ============================== */}
      <section className="border-y border-[#23262C] bg-[#0D0F11] py-4">
        <div className="relative overflow-hidden" style={{ maskImage: "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)" }}>
          <div className="lp-marquee flex w-max items-center gap-10 whitespace-nowrap pr-10">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((m, i) => (
              <span key={i} className="flex items-center gap-10 text-[12.5px] font-medium tracking-wide text-[#626975]">
                {m}
                <span className="h-1 w-1 rounded-full bg-[#7CD4AE]/60" aria-hidden />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== MODULES ============================== */}
      <section id="platform" className="relative mx-auto max-w-[1240px] px-6 py-28">
        <Reveal>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[#7CD4AE]">ONE SYSTEM OF RECORD</p>
          <h2 className="mt-3 max-w-[640px] text-[clamp(28px,3.4vw,44px)] font-semibold leading-[1.08] tracking-[-0.02em]">
            Eight modules. Every one of them works.
          </h2>
          <p className="mt-4 max-w-[560px] text-[15px] leading-7 text-[#8A909A]">
            Not a deck of mockups — a functioning workspace where briefs become analyses, scenarios, maps, graphs and
            exportable evidence. Click any module to use it.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m, i) => (
            <Reveal key={m.name} delay={i * 60}>
              <Link
                href={user ? m.href : `/login?redirect=${encodeURIComponent(m.href)}`}
                onMouseMove={onCardMove}
                className="lp-card-glow group flex h-full flex-col rounded-xl border border-[#23262C] bg-[#121417] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-[#353A42]"
              >
                <span className="mb-4 grid h-9 w-9 place-items-center rounded-lg border border-[#353A42] bg-[#0D0F11] text-[#C4C9D0] transition-colors group-hover:border-[#7CD4AE]/40 group-hover:text-[#7CD4AE]">
                  <m.icon size={16} aria-hidden />
                </span>
                <p className="text-[14.5px] font-semibold text-[#F2F3F5]">{m.name}</p>
                <p className="mt-1.5 flex-1 text-[12.5px] leading-5 text-[#8A909A]">{m.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#626975] transition-colors group-hover:text-[#7CD4AE]">
                  Open module <ArrowUpRight size={12} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============================ SCENARIO ENGINE ============================ */}
      <section id="engine" className="border-y border-[#23262C] bg-[#0D0F11]">
        <div className="mx-auto grid max-w-[1240px] gap-14 px-6 py-28 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <p className="text-[11px] font-semibold tracking-[0.22em] text-[#7CD4AE]">REPRODUCIBLE BY DESIGN</p>
            <h2 className="mt-3 text-[clamp(28px,3.4vw,44px)] font-semibold leading-[1.08] tracking-[-0.02em]">
              A scenario engine you can defend in a review meeting.
            </h2>
            <p className="mt-5 text-[15px] leading-7.5 text-[#8A909A]">
              Every constant is documented. Identical inputs always produce identical outputs — no decorative
              randomness, no &ldquo;AI magic&rdquo; presented as engineering. When uncertainty matters, the engine
              runs <span className="text-[#F2F3F5]">500 real Monte Carlo trials</span> with a fixed seed and explains
              its assumptions in plain language.
            </p>
            <ul className="mt-7 space-y-3.5">
              {[
                "Deterministic cost, schedule, capacity and risk model",
                "Seeded Monte Carlo — P10 / P50 / P90 with histogram",
                "Trade-offs explained, never just scored",
                "Scene inputs feed reports, graphs and analysis — one truth",
              ].map((f) => (
                <li key={f} className="flex items-start gap-3 text-[13.5px] leading-6 text-[#C4C9D0]">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#7CD4AE]" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/twin" className="group mt-8 inline-flex items-center gap-2 text-[14px] font-semibold text-[#7CD4AE]">
              Try the Digital Twin
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </Reveal>

          <Reveal delay={120}>
            <div className="lp-card-glow rounded-2xl border border-[#23262C] bg-[#121417] p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-[#F2F3F5]">Baseline scenario — live engine output</p>
                  <p className="mt-0.5 text-[11px] text-[#626975]">Rendered from runScenario() on this page, not a screenshot</p>
                </div>
                <FlaskConical size={16} className="text-[#7CD4AE]" aria-hidden />
              </div>
              <EngineBar label="Modeled capex vs ₹18,500 cr envelope" pct={Math.min(100, scenario.capex.budgetUtilizationPct)} display={`₹${scenario.capex.totalModeled.toLocaleString("en-IN")} cr`} accent />
              <EngineBar label="Demand coverage" pct={Math.min(100, scenario.demand.demandCoveragePct)} display={`${scenario.demand.demandCoveragePct.toFixed(0)}%`} />
              <EngineBar label="Composite risk" pct={scenario.risk.score} display={`${scenario.risk.score}/100`} />
              <EngineBar label="Sustainability score" pct={scenario.sustainability.score} display={`${scenario.sustainability.score}/100`} accent />
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#23262C] pt-5">
                <MiniStat k="Duration" v={`${scenario.schedule.estimatedYears} yrs`} />
                <MiniStat k="Fleet" v={`${scenario.resources.fleetTrains} trains`} />
                <MiniStat k="CO₂ avoided" v={`${(scenario.sustainability.co2AvoidedTonsPerYear / 1000).toFixed(1)}k t/yr`} />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================== WORKFLOW ============================== */}
      <section id="workflow" className="mx-auto max-w-[1240px] px-6 py-28">
        <Reveal>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[#7CD4AE]">END-TO-END, NOT END-TO-SLIDE</p>
          <h2 className="mt-3 max-w-[600px] text-[clamp(28px,3.4vw,44px)] font-semibold leading-[1.08] tracking-[-0.02em]">
            From brief to evidence in four moves.
          </h2>
        </Reveal>
        <div className="relative mt-14 grid gap-4 md:grid-cols-4">
          <div className="pointer-events-none absolute left-0 right-0 top-6 hidden border-t border-dashed border-[#353A42] md:block" aria-hidden />
          {WORKFLOW.map((s, i) => (
            <Reveal key={s.n} delay={i * 110} className="relative">
              <div className="relative z-10 mb-5 grid h-12 w-12 place-items-center rounded-lg border border-[#353A42] bg-[#0D0F11] text-[13px] font-bold tracking-widest text-[#7CD4AE]">
                {s.n}
              </div>
              <p className="text-[15px] font-semibold">{s.title}</p>
              <p className="mt-2 text-[13px] leading-6 text-[#8A909A]">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================================ CTA ================================ */}
      <section className="border-t border-[#23262C]">
        <div className="relative mx-auto max-w-[1240px] overflow-hidden px-6 py-28 text-center">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2"
            style={{ background: "radial-gradient(closest-side, rgba(124,212,174,0.09), transparent)" }}
            aria-hidden
          />
          <Reveal>
            <TrainFront size={22} className="mx-auto text-[#7CD4AE]" aria-hidden />
            <h2 className="mx-auto mt-5 max-w-[680px] text-[clamp(28px,3.6vw,48px)] font-semibold leading-[1.06] tracking-[-0.02em]">
              A 42-station metro is waiting in the demo workspace.
            </h2>
            <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-7 text-[#8A909A]">
              Press <kbd className="rounded border border-[#353A42] bg-[#121417] px-1.5 py-0.5 text-[11px] font-semibold text-[#F2F3F5]">Ctrl K</kbd> anywhere
              in the app, or walk straight into the Command Center.
            </p>
            <Link
              href="/overview"
              className="group mt-8 inline-flex items-center gap-2.5 rounded-lg bg-[#7CD4AE] px-7 py-3.5 text-[15px] font-bold text-[#0A0B0D] transition-all hover:-translate-y-0.5 hover:bg-[#6AC79F] hover:shadow-[0_12px_44px_rgba(124,212,174,0.25)]"
            >
              Launch RealityOS
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* =============================== FOOTER =============================== */}
      <footer className="border-t border-[#23262C] bg-[#0D0F11]">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6 px-6 py-10">
          <div className="flex items-center gap-2.5">
            <LogoMark size={18} />
            <div>
              <p className="text-[13px] font-semibold">RealityOS</p>
              <p className="text-[10.5px] text-[#626975]">The cognitive OS for intelligent infrastructure</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-5 text-[12px] text-[#8A909A]">
            <Link href="/overview" className="transition-colors hover:text-[#F2F3F5]">Command Center</Link>
            <Link href="/studio" className="transition-colors hover:text-[#F2F3F5]">Planning Studio</Link>
            <Link href="/twin" className="transition-colors hover:text-[#F2F3F5]">Digital Twin</Link>
            <Link href="/geo" className="transition-colors hover:text-[#F2F3F5]">Geo Intelligence</Link>
            <Link href="/reports" className="transition-colors hover:text-[#F2F3F5]">Reports</Link>
            <Link href="/privacy" className="transition-colors hover:text-[#F2F3F5]">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-[#F2F3F5]">Terms</Link>
          </nav>
          <p className="flex items-center gap-2 text-[11px] text-[#626975]">
            <ScanSearch size={12} aria-hidden />
            Prototype build · illustrative data · no live government sources
          </p>
        </div>
      </footer>
    </div>
  );
}

/* --------------------------------- Sections --------------------------------- */

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[#0D0F11] px-4 py-3.5">
      <p className="text-[19px] font-semibold tracking-tight text-[#F2F3F5]">{value}</p>
      <p className="mt-0.5 text-[10.5px] uppercase tracking-wider text-[#626975]">{label}</p>
    </div>
  );
}

function MiniStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-[#23262C] bg-[#0D0F11] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-[#626975]">{k}</p>
      <p className="mt-0.5 text-[13px] font-semibold text-[#F2F3F5]">{v}</p>
    </div>
  );
}

function EngineBar({ label, pct, display, accent }: { label: string; pct: number; display: string; accent?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          ob.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return (
    <div ref={ref} className="mb-4">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[11.5px]">
        <span className="text-[#8A909A]">{label}</span>
        <span className="font-semibold text-[#F2F3F5]">{display}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#0A0B0D]">
        <div
          className={cx("h-full rounded-full transition-[width] duration-1000 ease-out", accent ? "bg-[#7CD4AE]" : "bg-[#C4C9D0]")}
          style={{ width: on ? `${Math.min(100, pct)}%` : "0%", opacity: accent ? 1 : 0.55 }}
        />
      </div>
    </div>
  );
}
