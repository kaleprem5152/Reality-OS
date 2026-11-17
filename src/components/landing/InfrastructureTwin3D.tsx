"use client";

import { useEffect, useRef, useState } from "react";

/**
 * RealityOS — 3D Smart Infrastructure Digital Twin
 *
 * A miniature futuristic metropolitan city rendered entirely in Canvas 2D with
 * custom 3D perspective projection. Crash-proof across all browsers and React
 * strict-mode double-mounts. No external 3D library required.
 *
 * Visual Layers (back → front):
 *   1. Atmospheric glow
 *   2. City terrain platform (irregular oval with road grid)
 *   3. Infrastructure dependency arcs
 *   4. Architectural buildings (varied heights + window grids)
 *   5. Elevated metro viaduct supports
 *   6. Metro railway tracks (3 coloured routes)
 *   7. Station markers (amber interchange, cyan primary, mint secondary)
 *   8. Moving metro trains (3-car with headlight glow + red taillights)
 *   9. Light data pulses along track
 *  10. High-altitude telemetry arcs
 *  11. Orbital telemetry ring with degree ticks
 *  12. Mouse parallax spring system
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface Building {
  x: number; z: number; w: number; d: number; h: number;
  kind: "tower" | "mid" | "low" | "hub";
  windowRows: number; windowCols: number;
}

interface Station {
  id: number; x: number; z: number;
  name: string; type: "interchange" | "primary" | "secondary";
}

interface TrackRoute {
  id: string; color: string; glowColor: string;
  waypoints: [number, number][]; closed: boolean;
}

interface Train {
  routeId: string; t: number; speed: number; cars: number;
  color: string; headColor: string; tailColor: string;
}

interface Projected {
  sx: number; sy: number; s: number; z: number; v: boolean;
}

// ─── City data ────────────────────────────────────────────────────────────────

const BUILDINGS: Building[] = [
  // Downtown towers
  { x: 0.42, z: 0.1,  w: 0.11, d: 0.11, h: 0.72, kind: "tower", windowRows: 10, windowCols: 3 },
  { x: 0.56, z: 0.04, w: 0.09, d: 0.09, h: 0.56, kind: "tower", windowRows: 8,  windowCols: 2 },
  { x: 0.48, z:-0.14, w: 0.1,  d: 0.1,  h: 0.64, kind: "tower", windowRows: 9,  windowCols: 3 },
  { x: 0.62, z:-0.08, w: 0.08, d: 0.1,  h: 0.48, kind: "mid",   windowRows: 7,  windowCols: 2 },
  { x: 0.38, z:-0.24, w: 0.09, d: 0.09, h: 0.42, kind: "mid",   windowRows: 6,  windowCols: 2 },
  { x: 0.7,  z: 0.18, w: 0.07, d: 0.08, h: 0.36, kind: "mid",   windowRows: 5,  windowCols: 2 },
  // Finance core
  { x: 0.12, z: 0.06, w: 0.1,  d: 0.1,  h: 0.68, kind: "tower", windowRows: 10, windowCols: 3 },
  { x: 0.22, z:-0.08, w: 0.08, d: 0.09, h: 0.52, kind: "tower", windowRows: 7,  windowCols: 2 },
  { x: 0.02, z:-0.1,  w: 0.09, d: 0.08, h: 0.44, kind: "mid",   windowRows: 6,  windowCols: 2 },
  { x: 0.14, z:-0.22, w: 0.1,  d: 0.1,  h: 0.38, kind: "mid",   windowRows: 5,  windowCols: 2 },
  // Tech quarter
  { x:-0.3,  z:-0.05, w: 0.1,  d: 0.1,  h: 0.54, kind: "tower", windowRows: 8,  windowCols: 2 },
  { x:-0.44, z: 0.08, w: 0.08, d: 0.09, h: 0.42, kind: "mid",   windowRows: 6,  windowCols: 2 },
  { x:-0.2,  z: 0.14, w: 0.09, d: 0.08, h: 0.36, kind: "mid",   windowRows: 5,  windowCols: 2 },
  { x:-0.52, z:-0.12, w: 0.1,  d: 0.1,  h: 0.32, kind: "mid",   windowRows: 4,  windowCols: 2 },
  { x:-0.36, z:-0.2,  w: 0.08, d: 0.09, h: 0.26, kind: "low",   windowRows: 3,  windowCols: 2 },
  // Civic belt
  { x: 0.04, z: 0.32, w: 0.14, d: 0.12, h: 0.3,  kind: "hub",   windowRows: 4,  windowCols: 3 },
  { x: 0.26, z: 0.3,  w: 0.1,  d: 0.1,  h: 0.26, kind: "low",   windowRows: 3,  windowCols: 2 },
  { x:-0.14, z: 0.28, w: 0.09, d: 0.09, h: 0.22, kind: "low",   windowRows: 3,  windowCols: 2 },
  // Residential fringe
  { x:-0.68, z: 0.22, w: 0.08, d: 0.09, h: 0.2,  kind: "low",   windowRows: 3,  windowCols: 2 },
  { x:-0.76, z:-0.04, w: 0.09, d: 0.08, h: 0.18, kind: "low",   windowRows: 2,  windowCols: 2 },
  { x: 0.74, z:-0.3,  w: 0.08, d: 0.09, h: 0.22, kind: "low",   windowRows: 3,  windowCols: 2 },
  { x:-0.6,  z: 0.46, w: 0.1,  d: 0.1,  h: 0.16, kind: "low",   windowRows: 2,  windowCols: 2 },
  { x: 0.6,  z: 0.4,  w: 0.08, d: 0.09, h: 0.18, kind: "low",   windowRows: 2,  windowCols: 2 },
  { x:-0.2,  z:-0.44, w: 0.09, d: 0.09, h: 0.2,  kind: "low",   windowRows: 3,  windowCols: 2 },
  { x: 0.3,  z:-0.5,  w: 0.1,  d: 0.1,  h: 0.18, kind: "low",   windowRows: 2,  windowCols: 2 },
  // South logistics
  { x: 0.04, z:-0.52, w: 0.12, d: 0.1,  h: 0.14, kind: "hub",   windowRows: 2,  windowCols: 3 },
  { x:-0.46, z:-0.4,  w: 0.1,  d: 0.1,  h: 0.12, kind: "low",   windowRows: 1,  windowCols: 2 },
  { x: 0.56, z:-0.46, w: 0.08, d: 0.09, h: 0.14, kind: "low",   windowRows: 2,  windowCols: 2 },
];

const STATIONS: Station[] = [
  { id: 0, x: 0.0,  z: 0.0,  name: "Grand Central Interchange",  type: "interchange" },
  { id: 1, x: 0.5,  z: 0.0,  name: "Financial Core",             type: "primary"     },
  { id: 2, x:-0.4,  z: 0.0,  name: "Tech Quarter Terminal",      type: "primary"     },
  { id: 3, x: 0.0,  z: 0.42, name: "Civic Hub",                  type: "primary"     },
  { id: 4, x: 0.0,  z:-0.48, name: "South Logistics Gateway",    type: "secondary"   },
  { id: 5, x: 0.6,  z:-0.3,  name: "Waterfront Station",         type: "secondary"   },
  { id: 6, x:-0.62, z:-0.14, name: "West Valley Station",        type: "secondary"   },
  { id: 7, x:-0.42, z: 0.44, name: "North Orbital Junction",     type: "interchange" },
  { id: 8, x: 0.56, z: 0.3,  name: "Innovation Quarter",         type: "secondary"   },
  { id: 9, x:-0.22, z:-0.52, name: "Residential South",          type: "secondary"   },
];

const TRACK_ROUTES: TrackRoute[] = [
  {
    id: "L1", color: "rgba(0,229,255,0.85)", glowColor: "rgba(0,229,255,0.4)", closed: false,
    waypoints: [[-0.78,-0.14],[-0.62,-0.14],[-0.4,0.0],[-0.2,0.0],[0.0,0.0],[0.26,0.0],[0.5,0.0],[0.72,0.04]],
  },
  {
    id: "L2", color: "rgba(56,189,248,0.85)", glowColor: "rgba(56,189,248,0.4)", closed: false,
    waypoints: [[-0.42,0.44],[-0.2,0.26],[0.0,0.42],[0.0,0.26],[0.0,0.0],[0.0,-0.24],[0.0,-0.48],[0.0,-0.68]],
  },
  {
    id: "L3", color: "rgba(124,212,174,0.75)", glowColor: "rgba(124,212,174,0.35)", closed: true,
    waypoints: [[0.56,0.3],[0.6,-0.3],[0.3,-0.5],[-0.22,-0.52],[-0.46,-0.4],[-0.62,-0.14],[-0.42,0.44],[0.0,0.42],[0.56,0.3]],
  },
];

const TRAINS: Train[] = [
  { routeId: "L1", t: 0.08, speed: 0.09, cars: 3, color: "#00e5ff", headColor: "#ffffff", tailColor: "#f43f5e" },
  { routeId: "L1", t: 0.62, speed: 0.09, cars: 3, color: "#00e5ff", headColor: "#ffffff", tailColor: "#f43f5e" },
  { routeId: "L2", t: 0.15, speed: 0.07, cars: 3, color: "#38bdf8", headColor: "#e0f2fe", tailColor: "#f43f5e" },
  { routeId: "L2", t: 0.72, speed: 0.07, cars: 2, color: "#38bdf8", headColor: "#e0f2fe", tailColor: "#f43f5e" },
  { routeId: "L3", t: 0.3,  speed: 0.065, cars: 2, color: "#7cd4ae", headColor: "#d1fae5", tailColor: "#f43f5e" },
  { routeId: "L3", t: 0.78, speed: 0.065, cars: 2, color: "#7cd4ae", headColor: "#d1fae5", tailColor: "#f43f5e" },
];

const INFRA_ARCS = [
  { a: 0, b: 7, color: "rgba(245,158,11,0.55)", height: 0.42 },
  { a: 0, b: 1, color: "rgba(0,229,255,0.4)",   height: 0.3  },
  { a: 1, b: 8, color: "rgba(56,189,248,0.4)",  height: 0.28 },
  { a: 7, b: 3, color: "rgba(124,212,174,0.4)", height: 0.32 },
  { a: 2, b: 6, color: "rgba(0,229,255,0.35)",  height: 0.28 },
  { a: 4, b: 9, color: "rgba(124,212,174,0.35)",height: 0.24 },
];

// ─── Route utilities ──────────────────────────────────────────────────────────

function routeLength(route: TrackRoute): number {
  let len = 0;
  for (let i = 0; i < route.waypoints.length - 1; i++) {
    const dx = route.waypoints[i + 1][0] - route.waypoints[i][0];
    const dz = route.waypoints[i + 1][1] - route.waypoints[i][1];
    len += Math.sqrt(dx * dx + dz * dz);
  }
  return len;
}

function routePoint(route: TrackRoute, t: number): { x: number; z: number } {
  const pts = route.waypoints;
  const totalLen = routeLength(route);
  let dist = (((t % 1) + 1) % 1) * totalLen;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1];
    const segLen = Math.sqrt(dx * dx + dz * dz);
    if (dist <= segLen || i === pts.length - 2) {
      const frac = segLen > 0 ? Math.min(1, dist / segLen) : 0;
      return { x: pts[i][0] + dx * frac, z: pts[i][1] + dz * frac };
    }
    dist -= segLen;
  }
  return { x: pts[0][0], z: pts[0][1] };
}

// ─── Projection ───────────────────────────────────────────────────────────────

function makeProj(rotY: number, rotX: number, cx: number, cy: number, r: number, fov: number) {
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  return function p(wx: number, wy: number, wz: number): Projected {
    const x1 = wx * cosY + wz * sinY;
    const z1 = -wx * sinY + wz * cosY;
    const y2 = wy * cosX - z1 * sinX;
    const z2 = wy * sinX + z1 * cosX;
    const s = fov / (fov + z2);
    return { sx: cx + x1 * r * s, sy: cy - y2 * r * s, s, z: z2, v: z2 < fov * 0.95 };
  };
}

// ─── Draw helpers — all receive explicit ctx ──────────────────────────────────

type ProjFn = (wx: number, wy: number, wz: number) => Projected;

function drawTerrain(c: CanvasRenderingContext2D, p: ProjFn, cx: number, cy: number, r: number) {
  const steps = 64;
  c.beginPath();
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * Math.PI * 2;
    const rx = 0.9 + 0.08 * Math.cos(th * 3 + 0.5), rz = 0.74 + 0.07 * Math.sin(th * 2 + 1.2);
    const pt = p(Math.cos(th) * rx, 0, Math.sin(th) * rz);
    if (i === 0) c.moveTo(pt.sx, pt.sy); else c.lineTo(pt.sx, pt.sy);
  }
  c.closePath();
  const tg = c.createLinearGradient(cx - r * 0.9, cy - r * 0.3, cx + r * 0.9, cy + r * 0.4);
  tg.addColorStop(0, "rgba(14,20,28,0.95)");
  tg.addColorStop(0.5, "rgba(18,24,32,0.9)");
  tg.addColorStop(1, "rgba(10,14,20,0.95)");
  c.fillStyle = tg; c.fill();
  c.strokeStyle = "rgba(56,189,248,0.18)"; c.lineWidth = 1.5; c.stroke();

  const roads: [number, number, number, number][] = [
    [-0.85,0,0.85,0],[0,0,0,0.72],[0,0,0,-0.65],
    [-0.85,-0.18,0.85,-0.18],[-0.85,0.22,0.85,0.22],
    [-0.6,0,-0.6,0.72],[0.5,0,0.5,0.72],
    [-0.6,0,-0.6,-0.5],[0.5,0,0.5,-0.5],
  ];
  c.lineWidth = 0.6; c.strokeStyle = "rgba(42,56,70,0.6)";
  roads.forEach(([ax, az, bx, bz]) => {
    const pa = p(ax, 0.001, az), pb = p(bx, 0.001, bz);
    c.beginPath(); c.moveTo(pa.sx, pa.sy); c.lineTo(pb.sx, pb.sy); c.stroke();
  });
}

function drawBuilding(
  c: CanvasRenderingContext2D, p: ProjFn,
  b: Building, windowLit: boolean[][], rotY: number,
) {
  const { x, z, w, d, h, kind } = b;
  const hw = w / 2, hd = d / 2;
  const corners = [
    p(x - hw, 0, z - hd), p(x + hw, 0, z - hd), p(x + hw, 0, z + hd), p(x - hw, 0, z + hd),
    p(x - hw, h, z - hd), p(x + hw, h, z - hd), p(x + hw, h, z + hd), p(x - hw, h, z + hd),
  ];

  const faceIdx = [[0,1,5,4],[1,2,6,5],[3,0,4,7],[2,3,7,6]];
  const normals: [number, number][] = [[0,-1],[1,0],[-1,0],[0,1]];
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

  faceIdx.forEach(([a, bi, ci, di], fi) => {
    const [nx, nz] = normals[fi];
    const nzv = -nx * sinY + nz * cosY;
    if (nzv > 0.05) return;

    const pa = corners[a], pb = corners[bi], pc = corners[ci], pd = corners[di];
    const shade = Math.abs(nzv), wa = 0.82 + shade * 0.12;
    c.fillStyle = kind === "tower" ? `rgba(28,32,40,${wa})` :
      kind === "hub" ? `rgba(22,34,30,${wa})` : `rgba(24,28,34,${wa})`;
    c.beginPath();
    c.moveTo(pa.sx, pa.sy); c.lineTo(pb.sx, pb.sy);
    c.lineTo(pc.sx, pc.sy); c.lineTo(pd.sx, pd.sy);
    c.closePath(); c.fill();
    c.strokeStyle = `rgba(56,189,248,${0.12 + shade * 0.08})`; c.lineWidth = 0.6; c.stroke();

    const rows = b.windowRows, cols = b.windowCols;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tr = (row + 1) / (rows + 1), tc = (col + 1) / (cols + 1);
        const t1x = pa.sx + (pb.sx - pa.sx) * tc, t1y = pa.sy + (pb.sy - pa.sy) * tc;
        const t2x = pd.sx + (pc.sx - pd.sx) * tc, t2y = pd.sy + (pc.sy - pd.sy) * tc;
        const wx2 = t1x + (t2x - t1x) * tr, wy2 = t1y + (t2y - t1y) * tr;
        const lit = windowLit[row]?.[col] ?? true;
        c.fillStyle = kind === "hub" ? `rgba(124,212,174,${lit ? 0.8 : 0.08})` :
          kind === "tower" ? `rgba(0,229,255,${lit ? 0.75 : 0.06})` :
            `rgba(248,250,252,${lit ? 0.6 : 0.05})`;
        const ws = Math.max(0.8, 1.6 * (pa.s + pb.s + pc.s + pd.s) / 4);
        c.beginPath(); c.arc(wx2, wy2, ws, 0, Math.PI * 2); c.fill();
      }
    }

    if (fi === 0) {
      const rt = [corners[4], corners[5], corners[6], corners[7]];
      c.fillStyle = "rgba(36,42,52,0.55)";
      c.beginPath(); rt.forEach((pp, i) => i === 0 ? c.moveTo(pp.sx, pp.sy) : c.lineTo(pp.sx, pp.sy));
      c.closePath(); c.fill();

      if (kind === "tower") {
        const top = p(x, h + 0.06, z), roof = p(x, h, z);
        c.strokeStyle = "rgba(0,229,255,0.5)"; c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(roof.sx, roof.sy); c.lineTo(top.sx, top.sy); c.stroke();
        c.fillStyle = "#00e5ff"; c.beginPath(); c.arc(top.sx, top.sy, 1.4 * top.s, 0, Math.PI * 2); c.fill();
      }
    }
  });
}

function drawTrack(c: CanvasRenderingContext2D, p: ProjFn, route: TrackRoute) {
  const pts = route.waypoints, EY = 0.045;

  c.lineWidth = 0.8; c.strokeStyle = "rgba(56,89,110,0.7)";
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i+1][0]-pts[i][0], dz = pts[i+1][1]-pts[i][1];
    const segLen = Math.sqrt(dx*dx+dz*dz);
    const count = Math.max(2, Math.floor(segLen / 0.18));
    for (let s = 0; s <= count; s++) {
      const ft = s / count, px = pts[i][0]+dx*ft, pz = pts[i][1]+dz*ft;
      const top = p(px, EY, pz), bot = p(px, 0, pz);
      if (top.v) { c.beginPath(); c.moveTo(top.sx, top.sy); c.lineTo(bot.sx, bot.sy); c.stroke(); }
    }
  }

  [3.0, 1.2].forEach((lw, li) => {
    c.lineWidth = lw; c.strokeStyle = li === 0 ? route.glowColor : route.color;
    c.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const pp = p(pts[i][0], EY, pts[i][1]);
      if (i === 0) c.moveTo(pp.sx, pp.sy); else c.lineTo(pp.sx, pp.sy);
    }
    if (route.closed) c.closePath();
    c.stroke();
  });
}

function drawStation(c: CanvasRenderingContext2D, p: ProjFn, st: Station, t: number) {
  const EY = 0.06, pt = p(st.x, EY, st.z);
  if (!pt.v) return;

  const isInt = st.type === "interchange", isPri = st.type === "primary";
  const baseCol = isInt ? "#f59e0b" : isPri ? "#00e5ff" : "#7cd4ae";
  const coreR = isInt ? 5 : isPri ? 3.5 : 2.5;
  const haloBase = isInt ? 14 : isPri ? 9 : 6;
  const breath = Math.sin(t * 2.8 + st.id * 1.1) * 0.22 + 1;

  const pw = isInt ? 0.08 : 0.055, pl = isInt ? 0.14 : 0.1;
  const platC = [
    p(st.x - pw/2, EY, st.z - pl/2), p(st.x + pw/2, EY, st.z - pl/2),
    p(st.x + pw/2, EY, st.z + pl/2), p(st.x - pw/2, EY, st.z + pl/2),
  ];
  c.fillStyle = isInt ? "rgba(30,20,8,0.9)" : "rgba(8,20,30,0.9)";
  c.beginPath(); platC.forEach((pp, i) => i === 0 ? c.moveTo(pp.sx, pp.sy) : c.lineTo(pp.sx, pp.sy));
  c.closePath(); c.fill();
  c.strokeStyle = isInt ? "rgba(245,158,11,0.5)" : "rgba(0,229,255,0.4)"; c.lineWidth = 0.8; c.stroke();

  c.strokeStyle = isInt ? "rgba(245,158,11,0.7)" : isPri ? "rgba(0,229,255,0.6)" : "rgba(124,212,174,0.5)";
  c.lineWidth = isInt ? 1.8 : 1.2;
  c.beginPath(); c.arc(pt.sx, pt.sy, haloBase * pt.s * breath, 0, Math.PI * 2); c.stroke();
  if (isInt) {
    c.strokeStyle = "rgba(0,229,255,0.3)"; c.lineWidth = 1;
    c.beginPath(); c.arc(pt.sx, pt.sy, haloBase * pt.s * breath * 1.6, 0, Math.PI * 2); c.stroke();
  }

  c.fillStyle = baseCol; c.beginPath(); c.arc(pt.sx, pt.sy, coreR * pt.s, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(255,255,255,0.9)"; c.beginPath(); c.arc(pt.sx, pt.sy, 1.3 * pt.s, 0, Math.PI * 2); c.fill();
}

function drawTrain(c: CanvasRenderingContext2D, p: ProjFn, train: Train, tPos: number, route: TrackRoute) {
  const EY = 0.065;
  const totalLen = routeLength(route);
  const spacing = 0.038 / (totalLen || 1);
  for (let car = 0; car < train.cars; car++) {
    const carT = ((tPos - car * spacing) % 1 + 1) % 1;
    const rp = routePoint(route, carT);
    const pt = p(rp.x, EY, rp.z);
    if (!pt.v) continue;
    const isHead = car === 0, isTail = car === train.cars - 1;
    if (isHead) {
      const g = c.createRadialGradient(pt.sx, pt.sy, 0.5, pt.sx, pt.sy, 16 * pt.s);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.25, `${train.headColor}cc`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g; c.beginPath(); c.arc(pt.sx, pt.sy, 16 * pt.s, 0, Math.PI * 2); c.fill();
      c.fillStyle = train.headColor; c.beginPath(); c.arc(pt.sx, pt.sy, 3.2 * pt.s, 0, Math.PI * 2); c.fill();
    } else if (isTail) {
      c.fillStyle = train.tailColor; c.beginPath(); c.arc(pt.sx, pt.sy, 2 * pt.s, 0, Math.PI * 2); c.fill();
    } else {
      c.fillStyle = train.color; c.beginPath(); c.arc(pt.sx, pt.sy, 2.6 * pt.s, 0, Math.PI * 2); c.fill();
    }
  }
}

function drawPulses(c: CanvasRenderingContext2D, p: ProjFn, route: TrackRoute, t: number) {
  const EY = 0.052;
  const col = route.id === "L1" ? "rgba(0,229,255,0.9)" :
    route.id === "L2" ? "rgba(56,189,248,0.9)" : "rgba(124,212,174,0.9)";
  for (let i = 0; i < 3; i++) {
    const tPos = ((t * 0.28 + i / 3) % 1 + 1) % 1;
    const rp = routePoint(route, tPos);
    const pt = p(rp.x, EY, rp.z);
    if (!pt.v) continue;
    c.fillStyle = col; c.beginPath(); c.arc(pt.sx, pt.sy, 1.6 * pt.s, 0, Math.PI * 2); c.fill();
  }
}

function drawArcs(c: CanvasRenderingContext2D, p: ProjFn, t: number) {
  const EY = 0.045;
  INFRA_ARCS.forEach((arc, ai) => {
    const sA = STATIONS[arc.a], sB = STATIONS[arc.b];
    c.strokeStyle = arc.color; c.lineWidth = 1; c.beginPath();
    let vis = false;
    for (let si = 0; si <= 20; si++) {
      const ft = si / 20, it = 1 - ft;
      const mx = (sA.x+sB.x)/2, mz = (sA.z+sB.z)/2;
      const bx = it*it*sA.x + 2*it*ft*mx + ft*ft*sB.x;
      const by = it*it*EY   + 2*it*ft*arc.height + ft*ft*EY;
      const bz = it*it*sA.z + 2*it*ft*mz + ft*ft*sB.z;
      const pt = p(bx, by, bz);
      if (pt.v) vis = true;
      if (si === 0) c.moveTo(pt.sx, pt.sy); else c.lineTo(pt.sx, pt.sy);
    }
    if (vis) {
      c.stroke();
      const pkt = ((t * 0.4 + ai * 0.17) % 1), ipt = 1 - pkt;
      const mx = (sA.x+sB.x)/2, mz = (sA.z+sB.z)/2;
      const px2 = ipt*ipt*sA.x + 2*ipt*pkt*mx + pkt*pkt*sB.x;
      const py2 = ipt*ipt*EY   + 2*ipt*pkt*arc.height + pkt*pkt*EY;
      const pz2 = ipt*ipt*sA.z + 2*ipt*pkt*mz + pkt*pkt*sB.z;
      const pp = p(px2, py2, pz2);
      if (pp.v) { c.fillStyle = "#ffffff"; c.beginPath(); c.arc(pp.sx, pp.sy, 2*pp.s, 0, Math.PI*2); c.fill(); }
    }
  });
}

function drawOrbital(c: CanvasRenderingContext2D, p: ProjFn, basePitch: number, t: number) {
  const ringR = 1.14, tilt = basePitch * 0.65;
  c.lineWidth = 1; c.strokeStyle = "rgba(0,229,255,0.14)"; c.beginPath();
  for (let i = 0; i <= 80; i++) {
    const th = (i/80)*Math.PI*2;
    const pt = p(Math.cos(th)*ringR, -Math.sin(th)*Math.sin(tilt)*ringR, Math.sin(th)*Math.cos(tilt)*ringR);
    if (i === 0) c.moveTo(pt.sx, pt.sy); else c.lineTo(pt.sx, pt.sy);
  }
  c.closePath(); c.stroke();

  for (let i = 0; i < 36; i++) {
    const th = (i/36)*Math.PI*2, isMajor = i%6===0;
    const tr1 = ringR, tr2 = ringR + (isMajor ? 0.055 : 0.028);
    const p1 = p(Math.cos(th)*tr1, -Math.sin(th)*Math.sin(tilt)*tr1, Math.sin(th)*Math.cos(tilt)*tr1);
    const p2 = p(Math.cos(th)*tr2, -Math.sin(th)*Math.sin(tilt)*tr2, Math.sin(th)*Math.cos(tilt)*tr2);
    if (p1.v) {
      c.strokeStyle = isMajor ? "rgba(0,229,255,0.4)" : "rgba(0,229,255,0.15)"; c.lineWidth = isMajor ? 1 : 0.6;
      c.beginPath(); c.moveTo(p1.sx, p1.sy); c.lineTo(p2.sx, p2.sy); c.stroke();
    }
  }

  const bth = t * 0.6;
  const bp = p(Math.cos(bth)*ringR, -Math.sin(bth)*Math.sin(tilt)*ringR, Math.sin(bth)*Math.cos(tilt)*ringR);
  if (bp.v) {
    const bg = c.createRadialGradient(bp.sx, bp.sy, 0, bp.sx, bp.sy, 8*bp.s);
    bg.addColorStop(0, "rgba(0,229,255,0.9)"); bg.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = bg; c.beginPath(); c.arc(bp.sx, bp.sy, 8*bp.s, 0, Math.PI*2); c.fill();
    c.fillStyle = "#ffffff"; c.beginPath(); c.arc(bp.sx, bp.sy, 2*bp.s, 0, Math.PI*2); c.fill();
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InfrastructureTwin3D({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setFallback(true); return; }

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0, height = 0, rafId = 0, lastTs = 0, elapsed = 0, yaw = 0.4;
    let isVisible = true;
    let tgtPX = 0, tgtPY = 0, curPX = 0, curPY = 0;
    const trainTs = TRAINS.map((tr) => tr.t);
    const routeMap = new Map(TRACK_ROUTES.map((r) => [r.id, r]));

    // Stable window lit pattern
    const windowLit: boolean[][][] = BUILDINGS.map((b) =>
      Array.from({ length: b.windowRows }, () =>
        Array.from({ length: b.windowCols }, () => Math.random() > 0.28),
      ),
    );

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const io = new IntersectionObserver(([e]) => { isVisible = e.isIntersecting; }, { threshold: 0.05 });
    io.observe(canvas);

    const onMove = (e: MouseEvent) => {
      tgtPX = (e.clientX / window.innerWidth - 0.5) * 2;
      tgtPY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    const BASE_PITCH = 0.52;
    const FOV = 2.8;
    const CITY_SCALE = 0.46;

    const render = (ts: number) => {
      rafId = requestAnimationFrame(render);
      if (!isVisible) return;

      const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0;
      lastTs = ts;

      if (!prefersReduced) {
        elapsed += dt;
        yaw += 0.0032 * dt * 60;
        TRAINS.forEach((tr, i) => { trainTs[i] = (trainTs[i] + tr.speed * dt) % 1; });
      }

      curPX += (tgtPX - curPX) * 0.05;
      curPY += (tgtPY - curPY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const isDesk = width >= 1024;
      const cx = isDesk ? width * 0.63 + curPX * -28 : width * 0.5 + curPX * -18;
      const cy = height * 0.5 + curPY * -20;
      const r = Math.min(width * (isDesk ? 0.3 : 0.4), height * 0.42) * CITY_SCALE;
      const rotY = yaw + curPX * 0.6;
      const rotX = BASE_PITCH + curPY * 0.3;

      const p = makeProj(rotY, rotX, cx, cy, r, FOV);

      // Atmosphere
      const atm = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 2.0);
      atm.addColorStop(0, "rgba(0,229,255,0.055)");
      atm.addColorStop(0.4, "rgba(14,165,233,0.025)");
      atm.addColorStop(1, "rgba(10,11,13,0)");
      ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(cx, cy, r * 2.0, 0, Math.PI * 2); ctx.fill();

      drawTerrain(ctx, p, cx, cy, r);
      drawArcs(ctx, p, elapsed);

      // Sort buildings back-to-front
      const sorted = BUILDINGS.map((b, i) => ({ b, i, z: p(b.x, 0, b.z).z }))
        .sort((a, bv) => a.z - bv.z);
      sorted.forEach(({ b, i }) => drawBuilding(ctx, p, b, windowLit[i], rotY));

      TRACK_ROUTES.forEach((rt) => drawTrack(ctx, p, rt));
      STATIONS.forEach((st) => drawStation(ctx, p, st, elapsed));
      TRAINS.forEach((tr, i) => {
        const route = routeMap.get(tr.routeId);
        if (route) drawTrain(ctx, p, tr, trainTs[i], route);
      });
      TRACK_ROUTES.forEach((rt) => drawPulses(ctx, p, rt, elapsed));
      drawOrbital(ctx, p, BASE_PITCH, elapsed);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  if (fallback) {
    return (
      <div className={`flex items-center justify-center ${className ?? ""}`}>
        <div className="rounded-2xl border border-[#23262C] bg-[#121417] p-10 text-center opacity-80">
          <div className="mx-auto mb-4 h-20 w-20 rounded-full border border-[#38bdf8]/40 bg-[#0D0F11]" />
          <p className="text-[13px] text-[#8A909A]">Infrastructure Digital Twin</p>
        </div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none h-full w-full ${className ?? ""}`}
      aria-label="RealityOS 3D Smart Infrastructure Digital Twin — animated metropolitan city with metro network"
    />
  );
}

export { InfrastructureTwin3D as Globe3D };
