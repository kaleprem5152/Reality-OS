"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Minus, Plus, Tag } from "lucide-react";
import { CORRIDORS, CROSSINGS, LINE_COLORS, NETWORK_STATS, STATIONS } from "@/lib/data/metro-network";
import type { Corridor, Station } from "@/lib/types";
import { cx } from "@/lib/format";

const VB_W = 1040;
const VB_H = 560;
const BG = "#0F1114";

interface View {
  x: number;
  y: number;
  k: number;
}

export function NetworkSchematic({
  onSelect,
}: {
  onSelect?: (sel: { kind: "station" | "corridor"; station?: Station; corridor?: Corridor }) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [hover, setHover] = useState<Station | null>(null);
  const [selected, setSelected] = useState<{ kind: "station" | "corridor"; id: string } | null>(null);
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({ "Line A": true, "Line B": true });
  const [showLabels, setShowLabels] = useState(true);
  const [pxScale, setPxScale] = useState(1);
  const drag = useRef<{ px: number; py: number; vx: number; vy: number; moved: boolean } | null>(null);

  const stationById = useMemo(() => new Map(STATIONS.map((s) => [s.id, s])), []);

  /* Measure for tooltip positioning */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPxScale(el.clientWidth / VB_W));
    ro.observe(el);
    setPxScale(el.clientWidth / VB_W);
    return () => ro.disconnect();
  }, []);

  /* Non-passive wheel zoom anchored at the cursor */
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = ((e.clientX - r.left) / r.width) * VB_W;
      const my = ((e.clientY - r.top) / r.height) * VB_H;
      setView((v) => {
        const k = Math.min(3.2, Math.max(0.65, v.k * (e.deltaY < 0 ? 1.13 : 0.885)));
        return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (f: number) =>
    setView((v) => {
      const k = Math.min(3.2, Math.max(0.65, v.k * f));
      const mx = VB_W / 2;
      const my = VB_H / 2;
      return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k };
    });

  const reset = () => {
    setView({ x: 0, y: 0, k: 1 });
    setSelected(null);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    const r = (e.currentTarget as Element).getBoundingClientRect();
    setView((v) => ({ ...v, x: d.vx + (dx / r.width) * VB_W, y: d.vy + (dy / r.height) * VB_H }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const selectStation = useCallback(
    (s: Station) => {
      if (drag.current?.moved) return;
      setSelected({ kind: "station", id: s.id });
      onSelect?.({ kind: "station", station: s });
    },
    [onSelect],
  );
  const selectCorridor = useCallback(
    (c: Corridor) => {
      if (drag.current?.moved) return;
      setSelected({ kind: "corridor", id: c.id });
      onSelect?.({ kind: "corridor", corridor: c });
    },
    [onSelect],
  );

  const selStation = selected?.kind === "station" ? stationById.get(selected.id) ?? null : null;
  const activeCorridorIds = useMemo(() => {
    if (selected?.kind === "corridor") return new Set([selected.id]);
    if (selStation) return new Set(CORRIDORS.filter((c) => c.points.includes(selStation.id)).map((c) => c.id));
    return null;
  }, [selected, selStation]);

  const pathD = (c: Corridor) =>
    c.points
      .map((id, i) => {
        const s = stationById.get(id)!;
        return `${i ? "L" : "M"} ${s.x} ${s.y}`;
      })
      .join(" ");

  const visibleCorridors = CORRIDORS.filter((c) => visibleLines[c.line]);
  const visibleStations = STATIONS.filter((s) => visibleLines[s.line]);

  /* Tooltip screen position */
  const tip = hover
    ? { left: (hover.x * view.k + view.x) * pxScale, top: (hover.y * view.k + view.y) * pxScale }
    : null;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        {CORRIDORS.map((c) => {
          const on = visibleLines[c.line];
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => setVisibleLines((v) => ({ ...v, [c.line]: !v[c.line] }))}
              className={cx(
                "flex items-center gap-1.5 rounded border px-2 py-1 text-[10.5px] font-medium transition-colors",
                on ? "border-line-strong bg-surface text-ink" : "border-line text-faint opacity-55",
              )}
            >
              <span className="h-[3px] w-4 rounded-full" style={{ background: LINE_COLORS[c.line] }} aria-hidden />
              {c.line}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={showLabels}
          onClick={() => setShowLabels((v) => !v)}
          className={cx(
            "flex items-center gap-1.5 rounded border px-2 py-1 text-[10.5px] font-medium transition-colors",
            showLabels ? "border-line-strong bg-surface text-ink" : "border-line text-faint opacity-55",
          )}
        >
          <Tag size={11} aria-hidden /> Labels
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => zoomBy(1.2)} aria-label="Zoom in">
            <Plus size={12} aria-hidden />
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => zoomBy(0.84)} aria-label="Zoom out">
            <Minus size={12} aria-hidden />
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={reset} aria-label="Reset view">
            <Crosshair size={12} aria-hidden /> Reset
          </button>
        </div>
      </div>

      <div ref={wrapRef} className="relative overflow-hidden rounded-md border border-line" style={{ background: BG }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="block w-full cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          role="img"
          aria-label="Octolinear metro network schematic — pan, zoom, and select stations or corridors"
        >
          <defs>
            <pattern id="ns-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="#F2F3F5" strokeOpacity="0.035" strokeWidth="1" />
            </pattern>
            <filter id="ns-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width={VB_W} height={VB_H} fill={BG} />
          <rect width={VB_W} height={VB_H} fill="url(#ns-grid)" />

          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {/* Corridor casings + lines */}
            {visibleCorridors.map((c) => {
              const dimmed = activeCorridorIds !== null && !activeCorridorIds.has(c.id);
              return (
                <g key={c.id} opacity={dimmed ? 0.2 : 1} style={{ transition: "opacity .2s" }}>
                  <path
                    id={`ns-path-${c.id}`}
                    d={pathD(c)}
                    fill="none"
                    stroke={BG}
                    strokeWidth={13}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={pathD(c)}
                    fill="none"
                    stroke={LINE_COLORS[c.line]}
                    strokeWidth={activeCorridorIds?.has(c.id) ? 7 : 5.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="cursor-pointer"
                    style={{ transition: "stroke-width .2s" }}
                    onClick={() => selectCorridor(c)}
                  >
                    <title>{`${c.name} · ${c.lengthKm} km · ${c.status}`}</title>
                  </path>
                  {/* Live service pulse travelling the alignment */}
                  <circle r={3.6} fill={LINE_COLORS[c.line]} opacity={0.9} filter="url(#ns-glow)">
                    <animateMotion dur={c.id === "COR-A" ? "16s" : "13s"} repeatCount="indefinite" rotate="auto">
                      <mpath href={`#ns-path-${c.id}`} />
                    </animateMotion>
                  </circle>
                </g>
              );
            })}

            {/* Grade-separated crossing marker */}
            {visibleLines["Line A"] &&
              visibleLines["Line B"] &&
              CROSSINGS.map((cr) => (
                <g key={`${cr.x}-${cr.y}`}>
                  <circle cx={cr.x} cy={cr.y} r={9} fill={BG} />
                  <circle cx={cr.x} cy={cr.y} r={9} fill="none" stroke="#626975" strokeWidth={1} strokeDasharray="2 2" />
                  <title>{cr.note}</title>
                </g>
              ))}

            {/* Stations */}
            {visibleStations.map((s) => {
              const isSel = selected?.kind === "station" && selected.id === s.id;
              const isHov = hover?.id === s.id;
              const dim = activeCorridorIds !== null && !CORRIDORS.some((c) => activeCorridorIds.has(c.id) && c.points.includes(s.id));
              const color = LINE_COLORS[s.line as keyof typeof LINE_COLORS] ?? "#F2F3F5";
              return (
                <g
                  key={s.id}
                  opacity={dim ? 0.25 : 1}
                  style={{ transition: "opacity .2s" }}
                  className="cursor-pointer focus:outline-none"
                  tabIndex={0}
                  role="button"
                  aria-label={`${s.name}, ${s.type} on ${s.line}`}
                  onClick={() => selectStation(s)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectStation(s);
                    }
                  }}
                  onMouseEnter={() => setHover(s)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(s)}
                  onBlur={() => setHover(null)}
                >
                  <circle cx={s.x} cy={s.y} r={18} fill="transparent" />
                  {isSel && (
                    <circle cx={s.x} cy={s.y} r={12} fill="none" stroke={color} strokeWidth={2} opacity={0.55}>
                      <animate attributeName="r" values="11;24" dur="1.9s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.55;0" dur="1.9s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {s.type === "Terminal" ? (
                    <rect
                      x={s.x - 8.5} y={s.y - 8.5} width={17} height={17} rx={4.5}
                      fill={BG} stroke={color} strokeWidth={isSel || isHov ? 4 : 3}
                      style={{ transition: "stroke-width .15s" }}
                    />
                  ) : s.type === "Interchange" ? (
                    <>
                      <circle cx={s.x} cy={s.y} r={10} fill={BG} stroke="#F2F3F5" strokeWidth={isSel || isHov ? 3.6 : 2.8} />
                      <circle cx={s.x} cy={s.y} r={4} fill="#F2F3F5" />
                    </>
                  ) : (
                    <circle
                      cx={s.x} cy={s.y} r={isSel || isHov ? 7 : 6}
                      fill={BG} stroke={color} strokeWidth={isSel || isHov ? 4 : 3}
                      style={{ transition: "all .15s" }}
                    />
                  )}

                  {showLabels && (
                    <text
                      x={s.labelPos === "left" ? s.x - 17 : s.labelPos === "right" ? s.x + 17 : s.x}
                      y={s.labelPos === "top" ? s.y - 19 : s.labelPos === "bottom" ? s.y + 27 : s.y + 4.5}
                      textAnchor={s.labelPos === "left" ? "end" : s.labelPos === "right" ? "start" : "middle"}
                      fontSize={12}
                      fontWeight={s.type === "Standard" ? 500 : 650}
                      fill={isSel || isHov ? "#FFFFFF" : s.type === "Standard" ? "#9AA1AC" : "#E4E7EB"}
                      stroke={BG}
                      strokeWidth={3.5}
                      paintOrder="stroke"
                      className="pointer-events-none"
                      style={{ transition: "fill .15s" }}
                    >
                      {s.name}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover tooltip */}
        {hover && tip && (
          <div
            className="pointer-events-none absolute z-10 w-56 rounded-lg border border-line-strong bg-[#14171A] p-3 shadow-pop"
            style={{ left: tip.left, top: tip.top, transform: "translate(-50%, calc(-100% - 18px))" }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12.5px] font-semibold text-ink">{hover.name}</p>
              <span className="rounded bg-[#23262C] px-1.5 py-0.5 font-mono text-[9.5px] text-muted">{hover.code}</span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-muted">
              <span className="h-[3px] w-3 rounded-full" style={{ background: LINE_COLORS[hover.line as keyof typeof LINE_COLORS] }} aria-hidden />
              {hover.line} · {hover.type}
            </p>
            <p className="mt-1.5 text-[10.5px] leading-4 text-muted">{hover.catchment}</p>
            <div className="mt-2 flex items-center justify-between border-t border-line pt-1.5">
              <span className="text-[10px] text-faint">Daily riders</span>
              <span className="text-[11px] font-semibold text-ink">~{hover.dailyRidership.toLocaleString("en-IN")}</span>
            </div>
            {hover.suitability && (
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-faint">Suitability</span>
                <span className="text-[11px] font-semibold text-[#7CD4AE]">{hover.suitability.overall}/100</span>
              </div>
            )}
          </div>
        )}

        {/* In-canvas legend */}
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-md border border-line bg-[rgba(10,11,13,0.82)] px-2.5 py-1.5 backdrop-blur-sm">
          <LegendItem>
            <svg width="16" height="16" aria-hidden><rect x="2" y="2" width="12" height="12" rx="3.5" fill={BG} stroke="#F2F3F5" strokeWidth="3" /></svg>
            Terminal
          </LegendItem>
          <LegendItem>
            <svg width="16" height="16" aria-hidden><circle cx="8" cy="8" r="6.5" fill={BG} stroke="#F2F3F5" strokeWidth="2.6" /><circle cx="8" cy="8" r="2.6" fill="#F2F3F5" /></svg>
            Interchange
          </LegendItem>
          <LegendItem>
            <svg width="16" height="16" aria-hidden><circle cx="8" cy="8" r="4.6" fill={BG} stroke="#7CD4AE" strokeWidth="3" /></svg>
            Station
          </LegendItem>
          <LegendItem>
            <svg width="16" height="16" aria-hidden><circle cx="8" cy="8" r="6" fill="none" stroke="#626975" strokeWidth="1" strokeDasharray="2 2" /></svg>
            Grade-separated crossing
          </LegendItem>
        </div>

        <span className="pointer-events-none absolute right-2.5 top-2.5 rounded border border-line bg-[rgba(10,11,13,0.82)] px-2 py-1 font-mono text-[9.5px] text-faint backdrop-blur-sm">
          {Math.round(view.k * 100)}%
        </span>
      </div>

      <p className="mt-2 text-[10.5px] leading-4 text-muted">
        Octolinear transit diagram · drag to pan, scroll to zoom, click a station or corridor to inspect.{" "}
        {NETWORK_STATS.note}
      </p>
    </div>
  );
}

function LegendItem({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center gap-1 text-[9.5px] text-muted">{children}</span>;
}
