"use client";

import { Fragment, useEffect, useMemo } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip as LTooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CORRIDORS, LINE_COLORS, STATIONS } from "@/lib/data/metro-network";
import type { Station } from "@/lib/types";

export interface GeoSelection {
  kind: "station" | "corridor";
  id: string;
}

export interface GeoLayers {
  stations: boolean;
  corridors: boolean;
  catchments: boolean;
  labels: boolean;
  suitability: boolean;
}

const TILES = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  streets: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
};

/** Suitability ramp — semantic, accessible on dark tiles. */
function scoreColor(v: number): string {
  if (v >= 80) return "#3FA97F";
  if (v >= 70) return "#7CD4AE";
  if (v >= 60) return "#D2A24C";
  return "#D76060";
}

function stationIcon(s: Station, selected: boolean, suitabilityMode: boolean, showLabel: boolean): L.DivIcon {
  const lineColor = LINE_COLORS[s.line as keyof typeof LINE_COLORS] ?? "#F2F3F5";
  const color = suitabilityMode && s.suitability ? scoreColor(s.suitability.overall) : lineColor;
  const size = s.type === "Interchange" ? 20 : s.type === "Terminal" ? 18 : 14;
  const shape =
    s.type === "Interchange"
      ? `<span class="geo-dot geo-dot-interchange" style="--c:${color}"></span>`
      : s.type === "Terminal"
        ? `<span class="geo-dot geo-dot-terminal" style="--c:${color}"></span>`
        : `<span class="geo-dot geo-dot-std" style="--c:${color}"></span>`;
  const ring = selected ? `<span class="geo-pulse" style="--c:${color}"></span>` : "";
  const badge =
    suitabilityMode && s.suitability
      ? `<span class="geo-score" style="--c:${color}">${s.suitability.overall}</span>`
      : "";
  const label = showLabel ? `<span class="geo-label">${s.name}</span>` : "";
  return L.divIcon({
    className: "geo-marker",
    html: `<span class="geo-marker-inner">${ring}${shape}${badge}${label}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitAll({ flyTo, fitSignal }: { flyTo: [number, number] | null; fitSignal: number }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds(STATIONS.map((s) => [s.lat, s.lng]));
    map.fitBounds(bounds.pad(0.22));
  }, [map, fitSignal]);
  useEffect(() => {
    if (flyTo) map.flyTo(flyTo, 14, { duration: 0.5 });
  }, [flyTo, map]);
  return null;
}

function ScaleBar() {
  const map = useMap();
  useEffect(() => {
    const c = L.control.scale({ position: "bottomleft", imperial: false, metric: true });
    c.addTo(map);
    return () => {
      c.remove();
    };
  }, [map]);
  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const timer = setTimeout(() => map.invalidateSize(), 150);
    const container = map.getContainer();
    if (typeof ResizeObserver !== "undefined" && container) {
      const observer = new ResizeObserver(() => {
        map.invalidateSize();
      });
      observer.observe(container);
      return () => {
        clearTimeout(timer);
        observer.disconnect();
      };
    }
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export default function GeoMap({
  selection,
  onSelect,
  layers,
  baseLayer,
  flyTo,
  fitSignal,
}: {
  selection: GeoSelection | null;
  onSelect: (sel: GeoSelection) => void;
  layers: GeoLayers;
  baseLayer: "streets" | "light";
  flyTo: [number, number] | null;
  fitSignal: number;
}) {
  const stationById = useMemo(() => new Map(STATIONS.map((s) => [s.id, s])), []);

  return (
    <MapContainer
      center={[21.145, 79.08]}
      zoom={12}
      scrollWheelZoom
      className="z-0 h-full w-full"
      zoomControl={false}
    >
      <TileLayer key={baseLayer} url={TILES[baseLayer].url} attribution={TILES[baseLayer].attribution} />
      <ZoomControl position="bottomright" />
      <ScaleBar />
      <MapResizer />
      <FitAll flyTo={flyTo} fitSignal={fitSignal} />

      {layers.catchments &&
        STATIONS.map((s) => (
          <Circle
            key={`catch-${s.id}`}
            center={[s.lat, s.lng]}
            radius={800}
            pathOptions={{
              color: LINE_COLORS[s.line as keyof typeof LINE_COLORS] ?? "#F2F3F5",
              weight: 1,
              dashArray: "3 5",
              fillOpacity: 0.05,
            }}
          />
        ))}

      {layers.corridors &&
        CORRIDORS.map((c) => {
          const pts = c.points.map((id) => stationById.get(id)!).map((s) => [s.lat, s.lng] as [number, number]);
          const active = selection?.kind === "corridor" && selection.id === c.id;
          return (
            <Fragment key={c.id}>
              {/* casing */}
              <Polyline positions={pts} pathOptions={{ color: "#0A0B0D", weight: active ? 13 : 11, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
              <Polyline
                positions={pts}
                pathOptions={{
                  color: LINE_COLORS[c.line],
                  weight: active ? 6 : 4.5,
                  opacity: active ? 1 : 0.85,
                  lineCap: "round",
                  lineJoin: "round",
                }}
                eventHandlers={{ click: () => onSelect({ kind: "corridor", id: c.id }) }}
              >
                <LTooltip sticky>
                  <span className="text-[11px] font-medium">
                    {c.name} · {c.lengthKm} km · {c.status}
                  </span>
                </LTooltip>
              </Polyline>
            </Fragment>
          );
        })}

      {layers.stations &&
        STATIONS.map((s) => {
          const active = selection?.kind === "station" && selection.id === s.id;
          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={stationIcon(s, active, layers.suitability, layers.labels)}
              eventHandlers={{ click: () => onSelect({ kind: "station", id: s.id }) }}
              keyboard
              title={s.name}
            >
              <LTooltip direction="top" offset={[0, -14]}>
                <span className="text-[11px] leading-5">
                  <strong>{s.name}</strong> ({s.code})
                  <br />
                  {s.line} · {s.type}
                  <br />~{s.dailyRidership.toLocaleString("en-IN")} riders/day
                  {s.suitability ? (
                    <>
                      <br />
                      Suitability {s.suitability.overall}/100 <em>(illustrative)</em>
                    </>
                  ) : null}
                </span>
              </LTooltip>
            </Marker>
          );
        })}
    </MapContainer>
  );
}

export type { Station };
