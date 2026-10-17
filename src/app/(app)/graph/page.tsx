"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, Search } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { GRAPH_EDGES, GRAPH_NODE_COLORS, GRAPH_NODES } from "@/lib/data/knowledge-graph";
import { cx } from "@/lib/format";
import type { GraphNode, GraphNodeType } from "@/lib/types";

const NODE_TYPES: GraphNodeType[] = [
  "Project", "Corridor", "Station", "Utility", "Budget",
  "Environmental Constraint", "Regulation", "Dependency", "Risk",
];

interface Transform { x: number; y: number; k: number }

export default function GraphPage() {
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 0.86 });
  const [selectedId, setSelectedId] = useState<string | null>("G-PRJ");
  const [query, setQuery] = useState("");
  const [enabled, setEnabled] = useState<Set<GraphNodeType>>(new Set(NODE_TYPES));
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ px: number; py: number; tx: number; ty: number } | null>(null);

  const nodeById = useMemo(() => new Map(GRAPH_NODES.map((n) => [n.id, n])), []);

  // Native non-passive wheel zoom
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setTransform((t) => {
        const k2 = Math.min(2.2, Math.max(0.4, t.k * (e.deltaY < 0 ? 1.12 : 0.89)));
        const wx = (mx - t.x) / t.k;
        const wy = (my - t.y) / t.k;
        return { k: k2, x: mx - wx * k2, y: my - wy * k2 };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (f: number) =>
    setTransform((t) => {
      const rect = svgRef.current?.getBoundingClientRect();
      const mx = rect ? rect.width / 2 : 600;
      const my = rect ? rect.height / 2 : 400;
      const k2 = Math.min(2.2, Math.max(0.4, t.k * f));
      const wx = (mx - t.x) / t.k;
      const wy = (my - t.y) / t.k;
      return { k: k2, x: mx - wx * k2, y: my - wy * k2 };
    });

  const resetView = () => setTransform({ x: 0, y: 0, k: 0.86 });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as Element).closest("[data-node]")) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setTransform((t) => {
      dragRef.current = { px: e.clientX, py: e.clientY, tx: t.x, ty: t.y };
      return t;
    });
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setTransform((t) => ({ ...t, x: d.tx + (e.clientX - d.px), y: d.ty + (e.clientY - d.py) }));
  }, []);
  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => new Set(q ? GRAPH_NODES.filter((n) => `${n.label} ${n.type} ${n.detail}`.toLowerCase().includes(q)).map((n) => n.id) : []),
    [q],
  );

  const visibleEdges = useMemo(
    () =>
      GRAPH_EDGES.filter((e) => {
        const s = nodeById.get(e.source);
        const t = nodeById.get(e.target);
        return s && t && enabled.has(s.type) && enabled.has(t.type);
      }),
    [enabled, nodeById],
  );

  const connected = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const set = new Set<string>([selectedId]);
    for (const e of GRAPH_EDGES) {
      if (e.source === selectedId) set.add(e.target);
      if (e.target === selectedId) set.add(e.source);
    }
    return set;
  }, [selectedId]);

  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;

  const selectedRelations = useMemo(() => {
    if (!selectedId) return [];
    return GRAPH_EDGES.filter((e) => e.source === selectedId || e.target === selectedId).map((e) => ({
      other: e.source === selectedId ? nodeById.get(e.target)! : nodeById.get(e.source)!,
      relation: e.relation,
      explanation: e.explanation,
      direction: e.source === selectedId ? "out" : "in",
    }));
  }, [selectedId, nodeById]);

  const toggleType = (t: GraphNodeType) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const nodeW = (n: GraphNode) => Math.max(86, n.label.length * 6.2 + 18);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col" style={{ height: "calc(100vh - 130px)", minHeight: 620 }}>
      <PageHeader
        title="Knowledge Graph"
        subtitle="Explore entities and dependency chains across the Metro Intelligence programme. Typed edges only — every line has a stated relationship."
      />

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[1fr_330px]">
        {/* Graph canvas */}
        <div className="card relative flex min-h-0 flex-col overflow-hidden">
          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
              <input
                className="input h-8 w-56 py-1 pl-7 text-[12px]"
                placeholder="Search entities…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && matches.size > 0) setSelectedId([...matches][0]);
                }}
                aria-label="Search graph entities"
              />
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => zoomBy(1.2)} aria-label="Zoom in"><Plus size={13} aria-hidden /></button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => zoomBy(0.84)} aria-label="Zoom out"><Minus size={13} aria-hidden /></button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetView} aria-label="Reset view"><RotateCcw size={13} aria-hidden /> Reset</button>
            </div>
            <span className="ml-auto text-[11px] text-muted">
              {GRAPH_NODES.length} entities · {GRAPH_EDGES.length} relationships · drag to pan, scroll to zoom
            </span>
          </div>

          {/* type filters */}
          <div className="flex flex-wrap gap-1.5 border-b border-line bg-[#15181B] px-3 py-2">
            {NODE_TYPES.map((t) => {
              const on = enabled.has(t);
              const count = GRAPH_NODES.filter((n) => n.type === t).length;
              return (
                <button key={t} type="button" onClick={() => toggleType(t)} aria-pressed={on}
                  className={cx("flex items-center gap-1.5 rounded border px-2 py-1 text-[10.5px] transition-colors",
                    on ? "border-line bg-surface text-ink" : "border-line bg-transparent text-faint opacity-60")}>
                  <span className="h-2 w-2 rounded-full" style={{ background: GRAPH_NODE_COLORS[t] }} aria-hidden />
                  {t} ({count})
                </button>
              );
            })}
          </div>

          {/* svg */}
          <svg
            ref={svgRef}
            className="min-h-0 flex-1 cursor-grab touch-none active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            role="application"
            aria-label="Infrastructure knowledge graph"
          >
            <rect width="100%" height="100%" fill="#14171A" />
            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
              {/* edges */}
              {visibleEdges.map((e) => {
                const s = nodeById.get(e.source)!;
                const t = nodeById.get(e.target)!;
                const involveSel = selectedId === e.source || selectedId === e.target;
                const dim = selectedId && !involveSel;
                return (
                  <g key={`${e.source}-${e.target}`} opacity={dim ? 0.14 : 1}>
                    <line
                      x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                      stroke={involveSel ? "#F2F3F5" : "#3A404B"}
                      strokeWidth={involveSel ? 2 : 1.3}
                    />
                    {involveSel && (
                      <text x={(s.x + t.x) / 2} y={(s.y + t.y) / 2 - 4} textAnchor="middle"
                        fontSize="10" fontWeight={600} fill="#F2F3F5"
                        style={{ paintOrder: "stroke", stroke: "#14171A", strokeWidth: 3 }}>
                        {e.relation}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* nodes */}
              {GRAPH_NODES.filter((n) => enabled.has(n.type)).map((n) => {
                const w = nodeW(n);
                const isSel = selectedId === n.id;
                const isConn = connected.has(n.id);
                const dimBySel = selectedId && !isConn;
                const dimByQuery = q.length > 0 && !matches.has(n.id);
                return (
                  <g
                    key={n.id}
                    data-node
                    transform={`translate(${n.x},${n.y})`}
                    className="cursor-pointer"
                    opacity={dimBySel || dimByQuery ? 0.18 : 1}
                    onClick={() => setSelectedId(isSel ? null : n.id)}
                  >
                    <rect
                      x={-w / 2} y={-15} width={w} height={30} rx={6}
                      fill={isSel ? GRAPH_NODE_COLORS[n.type] : "#121417"}
                      stroke={GRAPH_NODE_COLORS[n.type]}
                      strokeWidth={isSel ? 2.2 : 1.4}
                      style={{ filter: isSel ? "drop-shadow(0 2px 6px rgba(16,24,40,0.25))" : undefined }}
                    />
                    <circle cx={-w / 2 + 11} cy={0} r={3.4} fill={isSel ? "#121417" : GRAPH_NODE_COLORS[n.type]} />
                    <text x={6} y={3.5} textAnchor="middle" fontSize={11} fontWeight={isSel ? 600 : 500}
                      fill={isSel ? "#121417" : "#F2F3F5"} className="pointer-events-none">
                      {n.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Details panel */}
        <aside className="card flex min-h-0 flex-col overflow-hidden" aria-label="Entity details">
          <div className="card-header">
            <p className="card-title">Entity details</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {!selected ? (
              <p className="py-10 text-center text-[12px] text-muted">
                Select a node to inspect its relationships and why they exist.
              </p>
            ) : (
              <div className="anim-fade">
                <span className="tag" style={{ background: `${GRAPH_NODE_COLORS[selected.type]}1A`, color: GRAPH_NODE_COLORS[selected.type], border: `1px solid ${GRAPH_NODE_COLORS[selected.type]}40` }}>
                  {selected.type}
                </span>
                <h2 className="mt-2 text-[15px] font-semibold text-ink">{selected.label}</h2>
                <p className="mt-2 text-[12.5px] leading-5.5 text-ink-2">{selected.detail}</p>

                {selected.meta && (
                  <div className="mt-3 space-y-1 border-t border-line pt-3">
                    {selected.meta.map((m) => (
                      <div key={m.label} className="flex items-baseline justify-between gap-3 py-1 text-[12px]">
                        <span className="text-muted">{m.label}</span>
                        <span className="text-right font-medium text-ink">{m.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 border-t border-line pt-3">
                  <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-faint">
                    Relationships ({selectedRelations.length})
                  </p>
                  {selectedRelations.length === 0 && (
                    <p className="text-[11.5px] text-muted">No typed relationships recorded for this entity.</p>
                  )}
                  <ul className="space-y-2">
                    {selectedRelations.map((r, i) => (
                      <li key={`${r.other.id}-${i}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(r.other.id)}
                          className="w-full rounded-md border border-line px-2.5 py-2 text-left transition-colors hover:bg-app-bg"
                        >
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                            {r.direction === "out" ? "→" : "←"} {r.relation}
                            <span className="font-normal text-muted">{r.other.label}</span>
                          </span>
                          <span className="mt-1 block text-[11px] leading-4.5 text-muted">{r.explanation}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-line px-4 py-2.5 text-[10px] leading-4 text-faint">
            All entities and relationships are illustrative but consistent with the project register, schematic and simulation data.
          </div>
        </aside>
      </div>
    </div>
  );
}
