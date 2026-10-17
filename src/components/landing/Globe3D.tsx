"use client";

import { useEffect, useRef } from "react";

/**
 * Interactive 3D wireframe globe rendered on canvas with raw projection math —
 * no 3D-library dependency. A particle-network sphere plus orbiting ring that
 * continuously rotates and tilts toward the pointer with eased (lerped) motion,
 * giving a physical, magnetic-feel mouse-parallax effect.
 * Respects prefers-reduced-motion by freezing rotation (static render).
 */
export function Globe3D({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    // Fibonacci sphere point cloud
    const N = 240;
    const pts: number[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      pts.push(Math.cos(th) * r, y, Math.sin(th) * r);
    }
    // Precompute neighbor links
    const LINK = 0.56;
    const edges: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = pts[i * 3] - pts[j * 3];
        const dy = pts[i * 3 + 1] - pts[j * 3 + 1];
        const dz = pts[i * 3 + 2] - pts[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < LINK * LINK) edges.push([i, j]);
      }
    }
    // Accent nodes (sparser, mint)
    const accents = new Set<number>();
    for (let i = 0; i < N; i++) if (i % 34 === 0) accents.add(i);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let mx = 0;
    let my = 0;
    let tx = 0;
    let ty = 0;
    const onMove = (e: MouseEvent) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const proj = new Float32Array(N * 3);
    let t = 0;

    const render = () => {
      if (!reduced) t += 0.0032;
      mx += (tx - mx) * 0.045;
      my += (ty - my) * 0.045;

      const rotY = t + mx * 1.35;
      const rotX = my * 0.9 + 0.24;
      const cy = Math.cos(rotY);
      const sy = Math.sin(rotY);
      const cx = Math.cos(rotX);
      const sx = Math.sin(rotX);

      ctx.clearRect(0, 0, w, h);
      const cxp = w / 2 + mx * -46;
      const cyp = h / 2 + my * -34;
      const R = Math.min(w, h) * 0.335;
      const fov = 3.3;

      for (let i = 0; i < N; i++) {
        const px = pts[i * 3];
        const py = pts[i * 3 + 1];
        const pz = pts[i * 3 + 2];
        const x1 = px * cy + pz * sy;
        const z1 = -px * sy + pz * cy;
        const y2 = py * cx - z1 * sx;
        const z2 = py * sx + z1 * cx;
        const s = fov / (fov + z2);
        proj[i * 3] = cxp + x1 * R * s;
        proj[i * 3 + 1] = cyp + y2 * R * s;
        proj[i * 3 + 2] = s;
      }

      // Links
      ctx.lineWidth = 1;
      for (const [a, b] of edges) {
        const depth = (proj[a * 3 + 2] + proj[b * 3 + 2]) / 2;
        const alpha = Math.max(0, depth - 0.74) * 0.62;
        if (alpha <= 0.012) continue;
        ctx.strokeStyle = `rgba(242,243,245,${Math.min(0.2, alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(proj[a * 3], proj[a * 3 + 1]);
        ctx.lineTo(proj[b * 3], proj[b * 3 + 1]);
        ctx.stroke();
      }

      // Nodes
      for (let i = 0; i < N; i++) {
        const s = proj[i * 3 + 2];
        const alpha = Math.max(0, s - 0.74) * 1.7;
        if (alpha <= 0.02) continue;
        const isAccent = accents.has(i);
        ctx.fillStyle = isAccent
          ? `rgba(124,212,174,${Math.min(0.95, alpha + 0.25).toFixed(3)})`
          : `rgba(242,243,245,${Math.min(0.55, alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(proj[i * 3], proj[i * 3 + 1], (isAccent ? 1.9 : 1.1) * s, 0, Math.PI * 2);
        ctx.fill();
      }

      // Orbit ring, counter-rotated and tilted
      const ringTilt = 0.42 + my * 0.25;
      ctx.strokeStyle = "rgba(124,212,174,0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let a = 0; a <= 72; a++) {
        const th = (a / 72) * Math.PI * 2;
        const rx = Math.cos(th) * 1.42;
        const rz = Math.sin(th) * 1.42;
        const x1 = rx * cy + rz * sy;
        const z1 = -rx * sy + rz * cy;
        const y2 = -z1 * Math.sin(ringTilt);
        const z2 = z1 * Math.cos(ringTilt);
        const s = fov / (fov + z2);
        const X = cxp + x1 * R * s;
        const Y = cyp + y2 * R * s;
        if (a === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      }
      ctx.stroke();

      // Satellite gliding along the ring
      const satTh = t * 2.6;
      const srx = Math.cos(satTh) * 1.42;
      const srz = Math.sin(satTh) * 1.42;
      const sx1 = srx * cy + srz * sy;
      const sz1 = -srx * sy + srz * cy;
      const sy2 = -sz1 * Math.sin(ringTilt);
      const sz2 = sz1 * Math.cos(ringTilt);
      const ss = fov / (fov + sz2);
      if (sz2 < 0.4) {
        ctx.fillStyle = "rgba(124,212,174,0.95)";
        ctx.beginPath();
        ctx.arc(cxp + sx1 * R * ss, cyp + sy2 * R * ss, 2.4 * ss, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
