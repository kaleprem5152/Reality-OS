"use client";

import { useEffect, useRef } from "react";

/**
 * RealityOS — 3D Smart Infrastructure Digital Twin
 *
 * Core Visual Concept:
 * A miniature metropolitan infrastructure environment and planetary digital twin
 * rendered on high-performance Canvas with 3D projection mathematics.
 *
 * Visual Features:
 * 1. Planetary digital twin base with 380+ architectural node points and landmass clusters.
 * 2. Elevated metro railway corridors connecting regional interchange stations.
 * 3. Continuous moving metro trains with streamlined carriages, bright cyan headlights, and taillights.
 * 4. Distinct station nodes with rhythmic breathing halo rings (Amber #f59e0b for major interchanges, Cyan #00e5ff for regional hubs).
 * 5. High-speed telemetry light pulses traveling along rail corridors between stations.
 * 6. High-altitude geodesic infrastructure telemetry arcs connecting critical facilities.
 * 7. Holographic equatorial cartographic telemetry ring with fine degree tick marks and rotating beacons.
 * 8. Responsive desktop framing biased toward the right half of the hero section for optimal visibility alongside text.
 * 9. Magnetic pointer parallax with smooth spring easing.
 * 10. Automatic pause on scroll-out (IntersectionObserver) & respects prefers-reduced-motion.
 */

interface Point3D {
  x: number;
  y: number;
  z: number;
  isCityHub?: boolean;
  hubType?: "interchange" | "primary" | "secondary";
  hubName?: string;
  elevation?: number;
}

interface StationNode {
  x: number;
  y: number;
  z: number;
  name: string;
  type: "interchange" | "primary" | "secondary";
  color: string;
  glowColor: string;
}

export function InfrastructureTwin3D({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let width = 0;
    let height = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    // 1. Generate Planetary Digital Twin Points (Fibonacci Sphere Distribution)
    const N = 320;
    const points: Point3D[] = [];
    const goldenRatio = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2; // -1 to 1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = goldenRatio * i;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      // Determine regional metropolitan density clusters
      const isUrbanCluster =
        (y > 0.15 && y < 0.65 && x > -0.2 && x < 0.8) || // North America / Europe belt
        (y > -0.1 && y < 0.5 && x < -0.3 && z > -0.4) ||  // Asia-Pacific corridor
        (y > 0.05 && y < 0.45 && z > 0.4);                // Emerging mega-regions

      points.push({
        x,
        y,
        z,
        isCityHub: isUrbanCluster && i % 4 === 0,
        elevation: isUrbanCluster ? 1.0 + (i % 5) * 0.035 : 1.0,
      });
    }

    // Precompute infrastructure grid links between neighboring nodes
    const MAX_LINK_DIST = 0.36;
    const gridEdges: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const dz = points[i].z - points[j].z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < MAX_LINK_DIST * MAX_LINK_DIST) {
          gridEdges.push([i, j]);
        }
      }
    }

    // 2. Strategic Station Nodes (Interchange & Primary Stations)
    const stationNodes: StationNode[] = [
      { x: 0.62, y: 0.42, z: 0.66, name: "Grand Central Interchange", type: "interchange", color: "#f59e0b", glowColor: "rgba(245,158,11,0.9)" },
      { x: 0.15, y: 0.68, z: 0.71, name: "Financial Core Station", type: "primary", color: "#00e5ff", glowColor: "rgba(0,229,255,0.9)" },
      { x: -0.45, y: 0.38, z: 0.81, name: "Tech Quarter Terminal", type: "primary", color: "#7cd4ae", glowColor: "rgba(124,212,174,0.9)" },
      { x: 0.82, y: -0.15, z: 0.54, name: "Waterfront Gateway", type: "primary", color: "#38bdf8", glowColor: "rgba(56,189,248,0.9)" },
      { x: -0.68, y: -0.22, z: 0.69, name: "South Logistics Hub", type: "secondary", color: "#00e5ff", glowColor: "rgba(0,229,255,0.7)" },
      { x: 0.35, y: -0.52, z: 0.77, name: "Civic Spine Station", type: "secondary", color: "#7cd4ae", glowColor: "rgba(124,212,174,0.7)" },
      { x: -0.22, y: 0.75, z: -0.62, name: "North Orbital Junction", type: "interchange", color: "#f59e0b", glowColor: "rgba(245,158,11,0.9)" },
    ];

    // Normalize station positions to sit slightly elevated above the digital twin surface
    stationNodes.forEach((s) => {
      const len = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
      const targetR = 1.05;
      s.x = (s.x / len) * targetR;
      s.y = (s.y / len) * targetR;
      s.z = (s.z / len) * targetR;
    });

    // 3. High-Altitude Geodesic Telemetry Arcs (Connecting Station Nodes)
    const telemetryArcs = [
      { from: 0, to: 1, height: 1.38, color: "rgba(0,229,255,0.65)" },
      { from: 1, to: 2, height: 1.34, color: "rgba(124,212,174,0.6)" },
      { from: 0, to: 3, height: 1.42, color: "rgba(245,158,11,0.7)" },
      { from: 2, to: 4, height: 1.35, color: "rgba(56,189,248,0.6)" },
      { from: 0, to: 6, height: 1.48, color: "rgba(245,158,11,0.7)" },
    ];

    // Pointer Parallax state with spring easing
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let targetParallaxX = 0;
    let targetParallaxY = 0;
    let currentParallaxX = 0;
    let currentParallaxY = 0;

    const onPointerMove = (e: MouseEvent) => {
      targetParallaxX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetParallaxY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onPointerMove, { passive: true });

    // Responsive Canvas Resize
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Visibility Observer to halt RAF loop when scrolled out of viewport
    let isVisible = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 },
    );
    observer.observe(canvas);

    // Projected buffer
    const projX = new Float32Array(N);
    const projY = new Float32Array(N);
    const projScale = new Float32Array(N);
    const projDepth = new Float32Array(N);

    let time = 0;

    // 4. Core Render Loop
    const render = () => {
      rafId = requestAnimationFrame(render);

      if (!isVisible) return;

      if (!prefersReducedMotion) {
        time += 0.0038;
      }

      // Parallax easing
      currentParallaxX += (targetParallaxX - currentParallaxX) * 0.045;
      currentParallaxY += (targetParallaxY - currentParallaxY) * 0.045;

      ctx.clearRect(0, 0, width, height);

      // On desktop (width >= 1024), bias center to the right for clear text readability
      const isDesktop = width >= 1024;
      const centerX = isDesktop ? width * 0.64 + currentParallaxX * -35 : width * 0.5 + currentParallaxX * -20;
      const centerY = height * 0.48 + currentParallaxY * -24;

      // Base globe radius scaled responsively
      const baseRadius = Math.min(width * (isDesktop ? 0.32 : 0.42), height * 0.38);
      const fov = 3.6;

      // Rotation angles
      const rotY = time + currentParallaxX * 0.85;
      const rotX = 0.32 + currentParallaxY * 0.65;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Helper: Project a 3D coordinate to 2D screen space
      const projectPoint = (x: number, y: number, z: number, scaleFactor = 1.0) => {
        // Yaw (Y-axis rotation)
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;

        // Pitch (X-axis tilt)
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        const s = fov / (fov + z2);
        const sx = centerX + x1 * baseRadius * scaleFactor * s;
        const sy = centerY + y2 * baseRadius * scaleFactor * s;

        return { sx, sy, s, z: z2 };
      };

      // Project all base digital twin points
      for (let i = 0; i < N; i++) {
        const pt = points[i];
        const elev = pt.elevation || 1.0;
        const p = projectPoint(pt.x, pt.y, pt.z, elev);
        projX[i] = p.sx;
        projY[i] = p.sy;
        projScale[i] = p.s;
        projDepth[i] = p.z;
      }

      // -----------------------------------------------------------------------
      // A. Deep Ambient Atmosphere & Holographic Radar Grid
      // -----------------------------------------------------------------------
      const glowGrad = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.2, centerX, centerY, baseRadius * 1.5);
      glowGrad.addColorStop(0, "rgba(0, 229, 255, 0.08)");
      glowGrad.addColorStop(0.5, "rgba(14, 165, 233, 0.03)");
      glowGrad.addColorStop(1, "rgba(10, 11, 13, 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Equatorial Holographic Dial & Telemetry Degree Ticks
      const eqTilt = 0.35 + currentParallaxY * 0.3;
      const eqRadius = 1.48;
      ctx.lineWidth = 1;

      // Outer Dial Ring
      ctx.beginPath();
      for (let a = 0; a <= 72; a++) {
        const th = (a / 72) * Math.PI * 2;
        const rx = Math.cos(th) * eqRadius;
        const rz = Math.sin(th) * eqRadius;
        const x1 = rx * cosY + rz * sinY;
        const z1 = -rx * sinY + rz * cosY;
        const y2 = -z1 * Math.sin(eqTilt);
        const z2 = z1 * Math.cos(eqTilt);
        const s = fov / (fov + z2);
        const X = centerX + x1 * baseRadius * s;
        const Y = centerY + y2 * baseRadius * s;

        if (a === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      }
      ctx.strokeStyle = "rgba(0, 229, 255, 0.16)";
      ctx.stroke();

      // Degree tick marks along dial
      for (let a = 0; a < 36; a++) {
        const th = (a / 36) * Math.PI * 2;
        const isMajor = a % 6 === 0;
        const tickLen = isMajor ? 0.07 : 0.035;

        const pIn = projectPoint(Math.cos(th) * eqRadius, -Math.sin(th) * Math.sin(eqTilt), Math.cos(th) * Math.cos(eqTilt));
        const pOut = projectPoint(
          Math.cos(th) * (eqRadius + tickLen),
          -Math.sin(th) * Math.sin(eqTilt) * (eqRadius + tickLen),
          Math.cos(th) * Math.cos(eqTilt) * (eqRadius + tickLen),
        );

        if (pIn.z < 0.8) {
          ctx.strokeStyle = isMajor ? "rgba(0, 229, 255, 0.45)" : "rgba(0, 229, 255, 0.15)";
          ctx.beginPath();
          ctx.moveTo(pIn.sx, pIn.sy);
          ctx.lineTo(pOut.sx, pOut.sy);
          ctx.stroke();
        }
      }

      // -----------------------------------------------------------------------
      // B. Infrastructure Grid Connections (Geographic Network Mesh)
      // -----------------------------------------------------------------------
      ctx.lineWidth = 1;
      for (let e = 0; e < gridEdges.length; e++) {
        const [a, b] = gridEdges[e];
        const depthA = projDepth[a];
        const depthB = projDepth[b];
        const avgDepth = (depthA + depthB) / 2;

        // Front-facing opacity gradient
        const alpha = Math.max(0, 1.0 - (avgDepth + 0.3) * 0.75) * 0.32;
        if (alpha <= 0.015) continue;

        ctx.strokeStyle = `rgba(56, 189, 248, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(projX[a], projY[a]);
        ctx.lineTo(projX[b], projY[b]);
        ctx.stroke();
      }

      // -----------------------------------------------------------------------
      // C. Base Planetary Digital Twin Nodes (Architectural Matrix)
      // -----------------------------------------------------------------------
      for (let i = 0; i < N; i++) {
        const depth = projDepth[i];
        if (depth > 0.95) continue; // Behind horizon

        const s = projScale[i];
        const alpha = Math.max(0, 1.0 - (depth + 0.25) * 0.85);
        if (alpha <= 0.02) continue;

        const isHub = points[i].isCityHub;

        if (isHub) {
          // Elevated architectural stalk
          const basePt = projectPoint(points[i].x, points[i].y, points[i].z, 1.0);
          ctx.strokeStyle = `rgba(0, 229, 255, ${(alpha * 0.6).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(basePt.sx, basePt.sy);
          ctx.lineTo(projX[i], projY[i]);
          ctx.stroke();

          // Hub Node Beacon
          ctx.fillStyle = `rgba(124, 212, 174, ${Math.min(0.95, alpha + 0.2).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(projX[i], projY[i], 2.2 * s, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Standard geographic node
          ctx.fillStyle = `rgba(242, 243, 245, ${(alpha * 0.55).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(projX[i], projY[i], 1.15 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // -----------------------------------------------------------------------
      // D. Elevated Metro Railway Corridors (Viaduct 1 & 2)
      // -----------------------------------------------------------------------
      // Corridor 1: Express Arterial Rail (Cyan Elevated Viaduct)
      const rail1Radius = 1.34;
      const rail1Tilt = 0.44 + currentParallaxY * 0.22;
      const railSegments = 96;

      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "rgba(0, 229, 255, 0.45)";
      ctx.beginPath();
      for (let a = 0; a <= railSegments; a++) {
        const th = (a / railSegments) * Math.PI * 2;
        const rx = Math.cos(th) * rail1Radius;
        const rz = Math.sin(th) * rail1Radius;
        const x1 = rx * cosY + rz * sinY;
        const z1 = -rx * sinY + rz * cosY;
        const y2 = -z1 * Math.sin(rail1Tilt);
        const z2 = z1 * Math.cos(rail1Tilt);
        const s = fov / (fov + z2);
        const X = centerX + x1 * baseRadius * s;
        const Y = centerY + y2 * baseRadius * s;

        if (a === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      }
      ctx.stroke();

      // Inner glowing running line
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
      ctx.stroke();

      // Corridor 2: Polar Orbital Feeder (Electric Blue)
      const rail2Radius = 1.28;
      const rail2Tilt = 1.15 + currentParallaxX * 0.15;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
      ctx.beginPath();
      for (let a = 0; a <= railSegments; a++) {
        const th = (a / railSegments) * Math.PI * 2;
        const ry = Math.cos(th) * rail2Radius;
        const rz = Math.sin(th) * rail2Radius;
        const x1 = rz * sinY;
        const z1 = rz * cosY;
        const y2 = ry * cosX - z1 * Math.sin(rail2Tilt);
        const z2 = ry * sinX + z1 * Math.cos(rail2Tilt);
        const s = fov / (fov + z2);
        const X = centerX + x1 * baseRadius * s;
        const Y = centerY + y2 * baseRadius * s;

        if (a === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      }
      ctx.stroke();

      // -----------------------------------------------------------------------
      // E. Continuous Moving Metro Trains & Telemetry Pulses
      // -----------------------------------------------------------------------
      // Train 1: Lead Express Train on Corridor 1
      const trainSpeed1 = time * 2.2;
      const train1Cars = [0, -0.045, -0.09]; // 3 carriages

      train1Cars.forEach((offset, carIndex) => {
        const th = trainSpeed1 + offset;
        const rx = Math.cos(th) * rail1Radius;
        const rz = Math.sin(th) * rail1Radius;
        const x1 = rx * cosY + rz * sinY;
        const z1 = -rx * sinY + rz * cosY;
        const y2 = -z1 * Math.sin(rail1Tilt);
        const z2 = z1 * Math.cos(rail1Tilt);
        const s = fov / (fov + z2);
        const X = centerX + x1 * baseRadius * s;
        const Y = centerY + y2 * baseRadius * s;

        if (z2 < 0.85) {
          if (carIndex === 0) {
            // Lead Locomotive Headlight Glow
            const glow = ctx.createRadialGradient(X, Y, 1, X, Y, 14 * s);
            glow.addColorStop(0, "rgba(255, 255, 255, 0.95)");
            glow.addColorStop(0.3, "rgba(0, 229, 255, 0.85)");
            glow.addColorStop(1, "rgba(0, 229, 255, 0)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(X, Y, 14 * s, 0, Math.PI * 2);
            ctx.fill();

            // Headlight core
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(X, Y, 3.2 * s, 0, Math.PI * 2);
            ctx.fill();
          } else if (carIndex === 2) {
            // Rear carriage red taillight
            ctx.fillStyle = "#f43f5e";
            ctx.beginPath();
            ctx.arc(X, Y, 2.2 * s, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Middle passenger carriage
            ctx.fillStyle = "#00e5ff";
            ctx.beginPath();
            ctx.arc(X, Y, 2.5 * s, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      // Train 2: Synchronized Train on Corridor 1 (180 deg phase offset)
      const trainSpeed2 = time * 2.2 + Math.PI;
      const t2_rx = Math.cos(trainSpeed2) * rail1Radius;
      const t2_rz = Math.sin(trainSpeed2) * rail1Radius;
      const t2_x1 = t2_rx * cosY + t2_rz * sinY;
      const t2_z1 = -t2_rx * sinY + t2_rz * cosY;
      const t2_y2 = -t2_z1 * Math.sin(rail1Tilt);
      const t2_z2 = t2_z1 * Math.cos(rail1Tilt);
      const t2_s = fov / (fov + t2_z2);
      if (t2_z2 < 0.85) {
        ctx.fillStyle = "#7cd4ae";
        ctx.beginPath();
        ctx.arc(centerX + t2_x1 * baseRadius * t2_s, centerY + t2_y2 * baseRadius * t2_s, 2.8 * t2_s, 0, Math.PI * 2);
        ctx.fill();
      }

      // Train 3: Polar Line Train on Corridor 2
      const trainSpeed3 = time * 1.8 + 1.2;
      const t3_ry = Math.cos(trainSpeed3) * rail2Radius;
      const t3_rz = Math.sin(trainSpeed3) * rail2Radius;
      const t3_x1 = t3_rz * sinY;
      const t3_z1 = t3_rz * cosY;
      const t3_y2 = t3_ry * cosX - t3_z1 * Math.sin(rail2Tilt);
      const t3_z2 = t3_ry * sinX + t3_z1 * Math.cos(rail2Tilt);
      const t3_s = fov / (fov + t3_z2);
      if (t3_z2 < 0.85) {
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.arc(centerX + t3_x1 * baseRadius * t3_s, centerY + t3_y2 * baseRadius * t3_s, 2.8 * t3_s, 0, Math.PI * 2);
        ctx.fill();
      }

      // High-speed light pulses traveling along track
      for (let p = 0; p < 4; p++) {
        const pulseAngle = time * 4.5 + (p * Math.PI) / 2;
        const px = Math.cos(pulseAngle) * rail1Radius;
        const pz = Math.sin(pulseAngle) * rail1Radius;
        const px1 = px * cosY + pz * sinY;
        const pz1 = -px * sinY + pz * cosY;
        const py2 = -pz1 * Math.sin(rail1Tilt);
        const pz2 = pz1 * Math.cos(rail1Tilt);
        const ps = fov / (fov + pz2);
        if (pz2 < 0.8) {
          ctx.fillStyle = p % 2 === 0 ? "rgba(0, 229, 255, 0.95)" : "rgba(245, 158, 11, 0.95)";
          ctx.beginPath();
          ctx.arc(centerX + px1 * baseRadius * ps, centerY + py2 * baseRadius * ps, 1.8 * ps, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // -----------------------------------------------------------------------
      // F. High-Altitude Geodesic Telemetry Arcs
      // -----------------------------------------------------------------------
      telemetryArcs.forEach((arc) => {
        const sA = stationNodes[arc.from];
        const sB = stationNodes[arc.to];
        const steps = 24;

        ctx.strokeStyle = arc.color;
        ctx.lineWidth = 1;
        ctx.beginPath();

        let arcVisible = false;
        for (let step = 0; step <= steps; step++) {
          const t = step / steps;
          // Spherical quadratic interpolation rising to arc.height
          const midX = (sA.x + sB.x) * 0.5 * arc.height;
          const midY = (sA.y + sB.y) * 0.5 * arc.height;
          const midZ = (sA.z + sB.z) * 0.5 * arc.height;

          // Bezier curve point
          const it = 1 - t;
          const ax = it * it * sA.x + 2 * it * t * midX + t * t * sB.x;
          const ay = it * it * sA.y + 2 * it * t * midY + t * t * sB.y;
          const az = it * it * sA.z + 2 * it * t * midZ + t * t * sB.z;

          const pt = projectPoint(ax, ay, az);
          if (pt.z < 0.85) arcVisible = true;

          if (step === 0) ctx.moveTo(pt.sx, pt.sy);
          else ctx.lineTo(pt.sx, pt.sy);
        }
        if (arcVisible) {
          ctx.stroke();

          // Traveling data telemetry packet along arc
          const packetT = (time * 1.5 + arc.from * 0.25) % 1;
          const it = 1 - packetT;
          const midX = (sA.x + sB.x) * 0.5 * arc.height;
          const midY = (sA.y + sB.y) * 0.5 * arc.height;
          const midZ = (sA.z + sB.z) * 0.5 * arc.height;

          const pax = it * it * sA.x + 2 * it * packetT * midX + packetT * packetT * sB.x;
          const pay = it * it * sA.y + 2 * it * packetT * midY + packetT * packetT * sB.y;
          const paz = it * it * sA.z + 2 * it * packetT * midZ + packetT * packetT * sB.z;
          const ppt = projectPoint(pax, pay, paz);

          if (ppt.z < 0.85) {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(ppt.sx, ppt.sy, 2.0 * ppt.s, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      // -----------------------------------------------------------------------
      // G. Glowing Station Nodes & Interchange Hubs
      // -----------------------------------------------------------------------
      stationNodes.forEach((station) => {
        const pt = projectPoint(station.x, station.y, station.z);
        if (pt.z > 0.85) return; // Behind horizon

        const s = pt.s;
        const isInterchange = station.type === "interchange";

        // Station Elevation Stalk
        const basePt = projectPoint(station.x / 1.05, station.y / 1.05, station.z / 1.05);
        ctx.strokeStyle = station.color;
        ctx.lineWidth = isInterchange ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(basePt.sx, basePt.sy);
        ctx.lineTo(pt.sx, pt.sy);
        ctx.stroke();

        // Rhythmic breathing halo ring
        const breathPulse = Math.sin(time * 3.2) * 0.25 + 1.0;
        const haloRadius = (isInterchange ? 11 : 7) * s * breathPulse;

        ctx.strokeStyle = station.glowColor;
        ctx.lineWidth = isInterchange ? 1.8 : 1.2;
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, haloRadius, 0, Math.PI * 2);
        ctx.stroke();

        if (isInterchange) {
          // Secondary outer concentric ring for major interchanges
          ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
          ctx.beginPath();
          ctx.arc(pt.sx, pt.sy, haloRadius * 1.5, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Solid station beacon core
        ctx.fillStyle = station.color;
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, (isInterchange ? 4.2 : 2.8) * s, 0, Math.PI * 2);
        ctx.fill();

        // White core highlight
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, 1.5 * s, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    render();

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none h-full w-full ${className || ""}`}
      aria-label="RealityOS 3D Smart Infrastructure Digital Twin"
    />
  );
}
