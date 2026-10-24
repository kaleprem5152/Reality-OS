"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ExternalLink,
  Layers,
  Minus,
  Network,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import {
  GRAPH_EDGES,
  GRAPH_NODE_COLORS,
  GRAPH_NODES,
  buildWorkspaceGraph,
} from "@/lib/data/knowledge-graph";
import { cx } from "@/lib/format";
import type { GraphEdge, GraphNode, GraphNodeType } from "@/lib/types";

const ALL_NODE_TYPES: GraphNodeType[] = [
  "Project",
  "Report",
  "Corridor",
  "Station",
  "Utility",
  "Budget",
  "Environmental Constraint",
  "Regulation",
  "Dependency",
  "Risk",
];

interface Transform {
  x: number;
  y: number;
  k: number;
}

export default function GraphPage() {
  const { projects, reports, loading, settings } = useApp();

  // Mode: "workspace" (real data) vs "demo" (static 20-node reference)
  const [mode, setMode] = useState<"workspace" | "demo">("workspace");
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 0.86 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [enabled, setEnabled] = useState<Set<GraphNodeType>>(new Set(ALL_NODE_TYPES));
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ px: number; py: number; tx: number; ty: number } | null>(null);

  // Compute graph based on mode and real data
  const { nodes, edges } = useMemo(() => {
    if (mode === "demo") {
      return { nodes: GRAPH_NODES, edges: GRAPH_EDGES };
    }
    return buildWorkspaceGraph(projects, reports, settings?.currency ?? "INR");
  }, [mode, projects, reports, settings?.currency]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Cleanly derive active selected node during render without cascading useEffect setState
  const activeSelectedId = (selectedId && nodeById.has(selectedId))
    ? selectedId
    : (nodes[0]?.id ?? null);

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
    () =>
      new Set(
        q
          ? nodes
              .filter((n) => `${n.label} ${n.type} ${n.detail}`.toLowerCase().includes(q))
              .map((n) => n.id)
          : [],
      ),
    [q, nodes],
  );

  const visibleEdges = useMemo(
    () =>
      edges.filter((e) => {
        const s = nodeById.get(e.source);
        const t = nodeById.get(e.target);
        return s && t && enabled.has(s.type) && enabled.has(t.type);
      }),
    [edges, enabled, nodeById],
  );

  const connected = useMemo(() => {
    if (!activeSelectedId) return new Set<string>();
    const set = new Set<string>([activeSelectedId]);
    for (const e of edges) {
      if (e.source === activeSelectedId) set.add(e.target);
      if (e.target === activeSelectedId) set.add(e.source);
    }
    return set;
  }, [activeSelectedId, edges]);

  const selected = activeSelectedId ? nodeById.get(activeSelectedId) ?? null : null;

  const selectedRelations = useMemo(() => {
    if (!activeSelectedId) return [];
    return edges
      .filter((e) => e.source === activeSelectedId || e.target === activeSelectedId)
      .map((e) => {
        const otherNode = e.source === activeSelectedId ? nodeById.get(e.target) : nodeById.get(e.source);
        return {
          other: otherNode!,
          relation: e.relation,
          explanation: e.explanation,
          direction: e.source === activeSelectedId ? ("out" as const) : ("in" as const),
        };
      })
      .filter((r) => Boolean(r.other));
  }, [activeSelectedId, edges, nodeById]);

  const toggleType = (t: GraphNodeType) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const nodeW = (n: GraphNode) => Math.max(90, n.label.length * 6.4 + 20);

  // Available node types in the current graph
  const availableTypes = useMemo(() => {
    const types = new Set(nodes.map((n) => n.type));
    return ALL_NODE_TYPES.filter((t) => types.has(t));
  }, [nodes]);

  if (loading) {
    return <LoadingBlock label="Loading knowledge graph entities…" />;
  }

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col" style={{ height: "calc(100vh - 130px)", minHeight: 620 }}>
      <PageHeader
        title="Knowledge Graph & Dependency Explorer"
        subtitle={
          mode === "workspace"
            ? "Live entity graph dynamically constructed from real workspace projects, corridor definitions, and evaluated reports."
            : "Demonstration knowledge graph reference. Static model illustrating cross-corridor utility, environmental, and risk dependencies."
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted">Mode:</span>
            <div className="inline-flex rounded border border-line bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setMode("workspace")}
                className={cx(
                  "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                  mode === "workspace" ? "bg-primary text-[#0A0B0D]" : "text-muted hover:text-ink",
                )}
              >
                Workspace Data ({projects.length})
              </button>
              <button
                type="button"
                onClick={() => setMode("demo")}
                className={cx(
                  "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                  mode === "demo" ? "bg-primary text-[#0A0B0D]" : "text-muted hover:text-ink",
                )}
              >
                Demo Reference (20)
              </button>
            </div>
          </div>
        }
      />

      {mode === "workspace" && nodes.length === 0 ? (
        <div className="card flex flex-1 items-center justify-center p-8">
          <EmptyState
            icon={Network}
            title="No Entities in Workspace"
            body="Your active workspace does not have any saved projects or reports. Create a project to start exploring entity and report dependency relationships."
            action={
              <div className="flex items-center gap-2">
                <Link href="/projects?new=1" className="btn btn-primary btn-sm">
                  New Project
                </Link>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode("demo")}>
                  View Demo Reference Model
                </button>
              </div>
            }
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[1fr_340px]">
          {/* Graph canvas */}
          <div className="card relative flex min-h-0 flex-col overflow-hidden">
            {/* Toolbar */}
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
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => zoomBy(1.2)} aria-label="Zoom in">
                  <Plus size={13} aria-hidden />
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => zoomBy(0.84)} aria-label="Zoom out">
                  <Minus size={13} aria-hidden />
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={resetView} aria-label="Reset view">
                  <RotateCcw size={13} aria-hidden /> Reset
                </button>
              </div>
              <span className="ml-auto text-[11px] text-muted">
                {nodes.length} entities · {edges.length} relationships · scroll to zoom, drag to pan
              </span>
            </div>

            {/* Type filters */}
            <div className="flex flex-wrap gap-1.5 border-b border-line bg-[#15181B] px-3 py-2">
              {availableTypes.map((t) => {
                const on = enabled.has(t);
                const count = nodes.filter((n) => n.type === t).length;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    aria-pressed={on}
                    className={cx(
                      "flex items-center gap-1.5 rounded border px-2 py-1 text-[10.5px] transition-colors",
                      on ? "border-line bg-surface text-ink" : "border-line bg-transparent text-faint opacity-60",
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: GRAPH_NODE_COLORS[t] ?? "#9AA1AC" }}
                      aria-hidden
                    />
                    {t} ({count})
                  </button>
                );
              })}
            </div>

            {/* SVG Canvas */}
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
                {/* Edges */}
                {visibleEdges.map((e) => {
                  const s = nodeById.get(e.source);
                  const t = nodeById.get(e.target);
                  if (!s || !t) return null;
                  const involveSel = activeSelectedId === e.source || activeSelectedId === e.target;
                  const dim = activeSelectedId && !involveSel;
                  return (
                    <g key={`${e.source}-${e.target}`} opacity={dim ? 0.14 : 1}>
                      <line
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke={involveSel ? "#F2F3F5" : "#3A404B"}
                        strokeWidth={involveSel ? 2 : 1.3}
                      />
                      {involveSel && (
                        <text
                          x={(s.x + t.x) / 2}
                          y={(s.y + t.y) / 2 - 4}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight={600}
                          fill="#F2F3F5"
                          style={{ paintOrder: "stroke", stroke: "#14171A", strokeWidth: 3 }}
                        >
                          {e.relation}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Nodes */}
                {nodes
                  .filter((n) => enabled.has(n.type))
                  .map((n) => {
                    const w = nodeW(n);
                    const isSel = activeSelectedId === n.id;
                    const isConn = connected.has(n.id);
                    const dimBySel = activeSelectedId && !isConn;
                    const dimByQuery = q.length > 0 && !matches.has(n.id);
                    const color = GRAPH_NODE_COLORS[n.type] ?? "#9AA1AC";
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
                          x={-w / 2}
                          y={-15}
                          width={w}
                          height={30}
                          rx={6}
                          fill={isSel ? color : "#121417"}
                          stroke={color}
                          strokeWidth={isSel ? 2.2 : 1.4}
                          style={{ filter: isSel ? "drop-shadow(0 2px 6px rgba(16,24,40,0.25))" : undefined }}
                        />
                        <circle cx={-w / 2 + 11} cy={0} r={3.4} fill={isSel ? "#121417" : color} />
                        <text
                          x={6}
                          y={3.5}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={isSel ? 600 : 500}
                          fill={isSel ? "#121417" : "#F2F3F5"}
                          className="pointer-events-none"
                        >
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
                  Select a node to inspect its attributes, relationships, and actions.
                </p>
              ) : (
                <div className="anim-fade space-y-4">
                  <div>
                    <span
                      className="tag"
                      style={{
                        background: `${GRAPH_NODE_COLORS[selected.type] ?? "#9AA1AC"}1A`,
                        color: GRAPH_NODE_COLORS[selected.type] ?? "#9AA1AC",
                        border: `1px solid ${GRAPH_NODE_COLORS[selected.type] ?? "#9AA1AC"}40`,
                      }}
                    >
                      {selected.type}
                    </span>
                    <h2 className="mt-2 text-[15px] font-semibold text-ink">{selected.label}</h2>
                    <p className="mt-1 text-[12px] leading-5 text-ink-2">{selected.detail}</p>
                  </div>

                  {/* Contextual navigation buttons for real workspace entities */}
                  {selected.type === "Project" && (
                    <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                      <Link
                        href={`/projects/${selected.id}`}
                        className="btn btn-secondary btn-sm flex items-center gap-1"
                      >
                        Open Project <ArrowUpRight size={12} aria-hidden />
                      </Link>
                      <Link
                        href={`/twin?project=${selected.id}`}
                        className="btn btn-secondary btn-sm flex items-center gap-1"
                      >
                        Digital Twin <ArrowUpRight size={12} aria-hidden />
                      </Link>
                    </div>
                  )}

                  {selected.type === "Report" && (
                    <div className="border-t border-line pt-3">
                      <Link
                        href={`/reports?open=${selected.id}`}
                        className="btn btn-secondary btn-sm flex items-center gap-1"
                      >
                        Open in Reports <ArrowUpRight size={12} aria-hidden />
                      </Link>
                    </div>
                  )}

                  {/* Attributes metadata */}
                  {selected.meta && (
                    <div className="space-y-1.5 border-t border-line pt-3">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-faint">Attributes</p>
                      {selected.meta.map((m) => (
                        <div key={m.label} className="flex items-baseline justify-between gap-3 py-0.5 text-[12px]">
                          <span className="text-muted">{m.label}</span>
                          <span className="text-right font-medium text-ink">{m.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dependencies & Milestones Notice */}
                  <div className="rounded border border-line bg-app-bg p-2.5 text-[11px] leading-4.5 text-muted">
                    <p className="font-semibold text-ink-2">Dependencies & Milestones</p>
                    <p className="mt-0.5">
                      {mode === "workspace"
                        ? "External dependency register and milestone tracking are not configured for this workspace. No fictitious dependencies are inferred."
                        : "Milestone schedule and critical paths in this demo view are illustrative models."}
                    </p>
                  </div>

                  {/* Typed Relationships */}
                  <div className="border-t border-line pt-3">
                    <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-faint">
                      Relationships ({selectedRelations.length})
                    </p>
                    {selectedRelations.length === 0 ? (
                      <p className="text-[11.5px] text-muted">No relationships connected to this entity.</p>
                    ) : (
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
                              <span className="mt-1 block text-[11px] leading-4 text-muted">{r.explanation}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-line px-4 py-2.5 text-[10px] leading-4 text-faint">
              {mode === "workspace"
                ? "Showing real workspace projects and reports. Nodes reflect current database records."
                : "Showing demo reference network. Entities and relationships are illustrative models."}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
