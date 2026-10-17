"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  GitCompareArrows,
  Layers,
  LocateFixed,
  MapPin,
  Maximize2,
  Scale,
  X,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import type { GeoLayers, GeoSelection } from "@/components/geo/GeoMap";
import { DemoBanner, PageHeader, StatusTag } from "@/components/ui";
import { CORRIDORS, STATIONS } from "@/lib/data/metro-network";
import { cx, formatNumber } from "@/lib/format";

const GeoMap = dynamic(() => import("@/components/geo/GeoMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center rounded-md bg-app-bg text-[12px] text-muted">
      Loading map tiles…
    </div>
  ),
});

const CRITERIA = [
  { key: "accessibility", label: "Accessibility", desc: "Walkshed and feeder access quality around the site." },
  { key: "populationCoverage", label: "Population coverage", desc: "Residents and jobs within the station catchment." },
  { key: "transitProximity", label: "Transit proximity", desc: "Distance to existing rail, BRT and bus interchanges." },
  { key: "environmental", label: "Environmental constraints", desc: "Flood exposure, heritage and ecological sensitivity." },
  { key: "landUse", label: "Land-use fit", desc: "Availability and compatibility of development parcels." },
] as const;

export default function GeoPage() {
  const { settings } = useApp();
  const [selection, setSelection] = useState<GeoSelection | null>({ kind: "station", id: "ST-11" });
  const [layers, setLayers] = useState<GeoLayers>({
    stations: true,
    corridors: true,
    catchments: false,
    labels: settings.mapShowLabels,
    suitability: false,
  });
  const [baseLayer, setBaseLayer] = useState<"streets" | "light">(settings.mapDefaultLayer);
  const [query, setQuery] = useState("");
  const [lineFilter, setLineFilter] = useState("All");
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [fitSignal, setFitSignal] = useState(0);
  const [compare, setCompare] = useState<string[]>(["ST-14", "ST-16"]);
  const [tab, setTab] = useState<"details" | "compare">("details");

  const station = selection?.kind === "station" ? STATIONS.find((s) => s.id === selection.id) : null;
  const corridor = selection?.kind === "corridor" ? CORRIDORS.find((c) => c.id === selection.id) : null;

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = STATIONS;
    if (lineFilter !== "All") rows = rows.filter((s) => s.line === lineFilter);
    if (q) rows = rows.filter((s) => `${s.name} ${s.code} ${s.catchment}`.toLowerCase().includes(q));
    return rows;
  }, [query, lineFilter]);

  const focusStation = (id: string) => {
    const s = STATIONS.find((x) => x.id === id);
    if (s) {
      setSelection({ kind: "station", id });
      setFlyTo([s.lat, s.lng]);
      setTab("details");
    }
  };

  const toggleCompare = (id: string) => {
    setCompare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? [...prev.slice(1), id] : [...prev, id],
    );
  };

  const compareStations = compare.map((id) => STATIONS.find((s) => s.id === id)!).filter(Boolean);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-3" style={{ height: "calc(100vh - 130px)", minHeight: 620 }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Geo Intelligence" subtitle="Evaluate candidate stations and corridors against geographic suitability criteria." />
        <div className="mb-5 max-w-md"><DemoBanner text="Candidate locations and suitability scores are illustrative demo data plotted over a real OpenStreetMap base layer — not verified GIS findings." /></div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[280px_1fr]">
        {/* Control column */}
        <div className="flex min-h-0 flex-col gap-3">
          <section className="card p-3.5" aria-label="Search and filters">
            <label className="label" htmlFor="g-search">Search locations</label>
            <input id="g-search" className="input" placeholder="Station name, code, catchment…"
              value={query} onChange={(e) => setQuery(e.target.value)} />
            <label className="label mt-3" htmlFor="g-line">Line filter</label>
            <select id="g-line" className="select" value={lineFilter} onChange={(e) => setLineFilter(e.target.value)}>
              <option value="All">All lines</option>
              <option value="Line A">Line A · Ring Trunk</option>
              <option value="Line B">Line B · Airport Link</option>
            </select>
            <div className="mt-3 max-h-44 overflow-y-auto rounded-md border border-line">
              {searchResults.length === 0 && (
                <p className="px-3 py-4 text-center text-[11.5px] text-muted">No locations match “{query}”.</p>
              )}
              {searchResults.map((s) => (
                <button key={s.id} type="button" onClick={() => focusStation(s.id)}
                  className={cx("flex w-full items-center gap-2 border-b border-line px-3 py-2 text-left text-[12px] transition-colors last:border-b-0 hover:bg-app-bg",
                    selection?.id === s.id && "bg-primary-soft/60")}>
                  <MapPin size={12} className="shrink-0 text-faint" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{s.name}</span>
                    <span className="block text-[10px] text-muted">{s.line} · {s.type}</span>
                  </span>
                  <LocateFixed size={12} className="shrink-0 text-faint" aria-hidden />
                </button>
              ))}
            </div>
          </section>

          <section className="card p-3.5" aria-label="Map layers">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-ink"><Layers size={13} aria-hidden /> Map layers</p>
            <div className="space-y-1.5">
              <LayerToggle label="Stations" on={layers.stations} onChange={() => setLayers((l) => ({ ...l, stations: !l.stations }))} />
              <LayerToggle label="Corridors" on={layers.corridors} onChange={() => setLayers((l) => ({ ...l, corridors: !l.corridors }))} />
              <LayerToggle label="Catchment rings (800 m)" on={layers.catchments} onChange={() => setLayers((l) => ({ ...l, catchments: !l.catchments }))} />
              <LayerToggle label="Station labels" on={layers.labels} onChange={() => setLayers((l) => ({ ...l, labels: !l.labels }))} />
              <LayerToggle label="Suitability heat" on={layers.suitability} onChange={() => setLayers((l) => ({ ...l, suitability: !l.suitability }))} />
            </div>
            <button type="button" className="btn btn-secondary btn-sm mt-3 w-full" onClick={() => setFitSignal((n) => n + 1)}>
              <Maximize2 size={12} aria-hidden /> Fit network
            </button>
            <label className="label mt-3" htmlFor="g-base">Base map</label>
            <select id="g-base" className="select" value={baseLayer} onChange={(e) => setBaseLayer(e.target.value as "streets" | "light")}>
              <option value="light">CARTO dark (mono)</option>
              <option value="streets">OpenStreetMap standard</option>
            </select>
          </section>

          <section className="card hidden p-3.5 lg:block" aria-label="Legend">
            <p className="mb-2 text-[12px] font-semibold text-ink">Legend</p>
            <div className="space-y-1.5 text-[11px] text-muted">
              <p className="flex items-center gap-2"><span className="h-[3px] w-5 rounded bg-[#F2F3F5]" /> Line A · Ring Trunk</p>
              <p className="flex items-center gap-2"><span className="h-[3px] w-5 rounded bg-[#7CD4AE]" /> Line B · Airport Link</p>
              <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-[#F2F3F5] bg-[#0A0B0D]" /> Interchange</p>
              <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm border-2 border-[#7CD4AE] bg-[#0A0B0D]" /> Terminal</p>
              <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full border-2 border-[#7CD4AE] bg-[#0A0B0D]" /> Station / candidate</p>
            </div>
            <p className="mt-2.5 border-t border-line pt-2 text-[10px] leading-4 text-faint">
              Enable <span className="text-muted">Suitability heat</span> to recolor markers by candidate score.
            </p>
          </section>
        </div>

        {/* Map + side panel */}
        <div className="grid min-h-0 gap-3 xl:grid-cols-[1fr_320px]">
          <section className="card relative min-h-[340px] overflow-hidden" aria-label="Interactive map">
            <GeoMap
              selection={selection}
              onSelect={(sel) => { setSelection(sel); setTab("details"); }}
              layers={layers}
              baseLayer={baseLayer}
              flyTo={flyTo}
              fitSignal={fitSignal}
            />
            {/* Map legend overlay */}
            <div className="pointer-events-none absolute left-2.5 top-2.5 z-[400] rounded-md border border-line bg-[rgba(10,11,13,0.84)] px-2.5 py-2 backdrop-blur-sm">
              <p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-wider text-faint">
                {layers.suitability ? "Suitability score" : "Network"}
              </p>
              {layers.suitability ? (
                <div className="space-y-1">
                  {[
                    ["#3FA97F", "80–100 · strong"],
                    ["#7CD4AE", "70–79 · good"],
                    ["#D2A24C", "60–69 · marginal"],
                    ["#D76060", "below 60 · weak"],
                  ].map(([c, l]) => (
                    <p key={l} className="flex items-center gap-1.5 text-[9.5px] text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: c }} aria-hidden /> {l}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-[9.5px] text-muted">
                    <span className="h-[3px] w-4 rounded-full bg-[#F2F3F5]" aria-hidden /> Line A · Ring Trunk
                  </p>
                  <p className="flex items-center gap-1.5 text-[9.5px] text-muted">
                    <span className="h-[3px] w-4 rounded-full bg-[#7CD4AE]" aria-hidden /> Line B · Airport Link
                  </p>
                  <p className="flex items-center gap-1.5 text-[9.5px] text-muted">
                    <span className="h-2.5 w-2.5 rounded-full border-2 border-[#F2F3F5]" aria-hidden /> Interchange
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside className="card flex min-h-0 flex-col overflow-hidden" aria-label="Details panel">
            <div className="grid grid-cols-2 border-b border-line">
              <button type="button" onClick={() => setTab("details")}
                className={cx("px-3 py-2.5 text-[11.5px] font-semibold", tab === "details" ? "bg-primary-soft/60 text-primary" : "text-muted hover:text-ink")}>
                Details
              </button>
              <button type="button" onClick={() => setTab("compare")}
                className={cx("relative px-3 py-2.5 text-[11.5px] font-semibold", tab === "compare" ? "bg-primary-soft/60 text-primary" : "text-muted hover:text-ink")}>
                Compare ({compare.length})
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "details" && (
                <div className="p-4">
                  {station && (
                    <div className="anim-fade">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[14px] font-semibold text-ink">{station.name}</p>
                          <p className="mt-0.5 text-[11px] text-muted">{station.code} · {station.line} · {station.type}</p>
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { toggleCompare(station.id); setTab("compare"); }}>
                          <GitCompareArrows size={12} aria-hidden /> {compare.includes(station.id) ? "In compare" : "Compare"}
                        </button>
                      </div>
                      <p className="mt-3 text-[12px] leading-5 text-ink-2">{station.catchment}</p>
                      <div className="mt-3 space-y-1 border-t border-line pt-3">
                        <Row k="Est. daily ridership" v={`~${formatNumber(station.dailyRidership)}`} />
                        {station.suitability && <Row k="Overall suitability" v={`${station.suitability.overall}/100`} />}
                        <Row k="Coordinates" v={`${station.lat.toFixed(3)}°N, ${station.lng.toFixed(3)}°E (illustrative)`} />
                      </div>
                      {station.suitability && (
                        <>
                          <p className="mb-2 mt-4 text-[10.5px] font-semibold uppercase tracking-wider text-faint">Suitability criteria (illustrative)</p>
                          {CRITERIA.map((c) => (
                            <div key={c.key} className="mb-2">
                              <div className="flex items-baseline justify-between text-[11px]">
                                <span className="text-muted" title={c.desc}>{c.label}</span>
                                <span className="font-semibold text-ink">{station.suitability![c.key]}</span>
                              </div>
                              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-app-bg">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${station.suitability![c.key]}%` }} />
                              </div>
                            </div>
                          ))}
                          <p className="mt-3 rounded-md border border-line bg-app-bg px-2.5 py-2 text-[11px] leading-4.5 text-muted">
                            {station.suitability.note}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  {corridor && (
                    <div className="anim-fade">
                      <p className="text-[14px] font-semibold text-ink">{corridor.name}</p>
                      <div className="mt-1"><StatusTag status={corridor.status} /></div>
                      <p className="mt-3 text-[12px] leading-5 text-ink-2">{corridor.description}</p>
                      <div className="mt-3 space-y-1 border-t border-line pt-3">
                        <Row k="Length" v={`${corridor.lengthKm} km`} />
                        <Row k="Key stations" v={String(corridor.points.length)} />
                        <Row k="Line" v={corridor.line} />
                      </div>
                      <p className="mb-1.5 mt-4 text-[10.5px] font-semibold uppercase tracking-wider text-faint">Stations on this corridor</p>
                      <ul className="space-y-1">
                        {corridor.points.map((pid) => {
                          const s = STATIONS.find((x) => x.id === pid)!;
                          return (
                            <li key={pid}>
                              <button type="button" onClick={() => focusStation(s.id)}
                                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[11.5px] text-ink-2 transition-colors hover:bg-app-bg">
                                {s.name}
                                <span className="text-[10px] text-faint">{s.type}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {!station && !corridor && (
                    <p className="py-10 text-center text-[12px] text-muted">Select a station or corridor on the map to inspect it.</p>
                  )}
                </div>
              )}

              {tab === "compare" && (
                <div className="p-4">
                  {compareStations.length === 0 ? (
                    <p className="py-10 text-center text-[12px] text-muted">
                      Add up to three stations from the map or the details panel to compare their suitability scores.
                    </p>
                  ) : (
                    <>
                      <div className="table-wrap">
                        <table className="tbl">
                          <thead>
                            <tr>
                              <th>Criterion</th>
                              {compareStations.map((s) => (
                                <th key={s.id}>
                                  <span className="flex items-center gap-1">
                                    {s.code}
                                    <button type="button" onClick={() => toggleCompare(s.id)} aria-label={`Remove ${s.name}`}
                                      className="text-faint hover:text-critical"><X size={11} aria-hidden /></button>
                                  </span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="font-medium text-ink">Overall</td>
                              {compareStations.map((s) => {
                                const best = Math.max(...compareStations.map((x) => x.suitability?.overall ?? 0));
                                const val = s.suitability?.overall ?? 0;
                                return (
                                  <td key={s.id} className={cx("font-semibold", val === best ? "text-success" : "text-ink")}>
                                    {val}
                                    {val === best && <span className="ml-1 text-[9px] font-bold uppercase">best</span>}
                                  </td>
                                );
                              })}
                            </tr>
                            <tr>
                              <td className="font-medium text-ink">Ridership</td>
                              {compareStations.map((s) => (
                                <td key={s.id}>{formatNumber(s.dailyRidership)}</td>
                              ))}
                            </tr>
                            {CRITERIA.map((c) => (
                              <tr key={c.key}>
                                <td className="font-medium text-ink" title={c.desc}>{c.label}</td>
                                {compareStations.map((s) => {
                                  const v = s.suitability?.[c.key];
                                  return (
                                    <td key={s.id}>
                                      {v !== undefined ? (
                                        <span className="flex items-center gap-1.5">
                                          <span className="inline-block h-1.5 w-8 overflow-hidden rounded-full bg-app-bg align-middle">
                                            <span className="block h-full bg-primary" style={{ width: `${v}%` }} />
                                          </span>
                                          {v}
                                        </span>
                                      ) : "—"}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-3 space-y-2">
                        {compareStations.map((s) => (
                          <p key={s.id} className="rounded-md border border-line bg-app-bg px-2.5 py-2 text-[11px] leading-4.5 text-muted">
                            <span className="font-semibold text-ink-2">{s.name}:</span> {s.suitability?.note}
                          </p>
                        ))}
                      </div>
                      <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-4 text-faint">
                        <Scale size={11} className="mt-0.5 shrink-0" aria-hidden />
                        Scores weight accessibility, coverage, transit proximity, environmental pressure and land-use fit equally — illustrative model for option screening.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function LayerToggle({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} aria-pressed={on}
      className="flex w-full items-center justify-between rounded px-1 py-1 text-[12px] text-ink-2 transition-colors hover:bg-app-bg">
      {label}
      <span className={cx("relative h-4 w-7 rounded-full transition-colors", on ? "bg-primary" : "bg-line-strong")} aria-hidden>
        <span className={cx("absolute top-0.5 h-3 w-3 rounded-full transition-all", on ? "left-3.5 bg-[#0A0B0D]" : "left-0.5 bg-[#F2F3F5]")} />
      </span>
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[12px]">
      <span className="text-muted">{k}</span>
      <span className="text-right font-medium text-ink">{v}</span>
    </div>
  );
}
