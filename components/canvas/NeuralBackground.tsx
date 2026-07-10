// components/canvas/NeuralBackground.tsx
// Animated topographic contour lines — elegant depth, suggests structured thinking
"use client";

import { useEffect, useRef } from "react";

// ── Tiny value-noise implementation (no deps) ────────────────────────────────

function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a: number, b: number, t: number) { return a + t * (b - a); }

// Deterministic hash → pseudo-random float in [0,1]
function h(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function noise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix,        fy = y - iy;
  const ux = fade(fx),      uy = fade(fy);
  const a = h(ix     + iy     * 57);
  const b = h(ix + 1 + iy     * 57);
  const c = h(ix     + (iy+1) * 57);
  const d = h(ix + 1 + (iy+1) * 57);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

// Fractional brownian motion — stacks octaves for more organic look
function fbm(x: number, y: number, octaves = 4): number {
  let v = 0, amp = 0.5, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    v   += noise(x * freq, y * freq) * amp;
    max += amp;
    amp  *= 0.5;
    freq *= 2.1;
  }
  return v / max;
}

// ── Marching-squares edge table ───────────────────────────────────────────────

// For each of 16 corner configurations, which edges to draw (using linear interp)
// edges encoded as [a,b,c,d] where each pair is a normalised position on a cell edge
// 0=left, 1=bottom, 2=right, 3=top  — we only need the segments per config
type Seg = [number, number, number, number]; // x0,y0 → x1,y1 in 0-1 cell space

function getSegments(
  v00: number, v10: number, v11: number, v01: number, level: number
): Seg[] {
  const bits =
    (v00 > level ? 8 : 0) |
    (v10 > level ? 4 : 0) |
    (v11 > level ? 2 : 0) |
    (v01 > level ? 1 : 0);

  // Helper: interpolate where the level crosses an edge
  function interp(va: number, vb: number): number {
    return (level - va) / (vb - va);
  }

  // Each cell edge: left=x0, bottom=y1, right=x1, top=y0
  const t = interp(v00, v01); // left edge  (x=0, y=t)
  const b = interp(v10, v11); // right edge (x=1, y=t)
  const l = interp(v00, v10); // top edge   (y=0, x=l)
  const r = interp(v01, v11); // bottom edge(y=1, x=r)

  // Only the 4 saddle cases (5,10) produce two segments; handle them with avg
  const mid = (v00 + v10 + v11 + v01) / 4;

  switch (bits) {
    case  1: return [[0,t, l,0]];
    case  2: return [[r,1, b,0]];
    case  3: return [[0,t, r,1]];
    case  4: return [[l,0, b,0]];
    case  5: return mid > level
               ? [[0,t, b,0],[l,0, r,1]]
               : [[0,t, l,0],[b,0, r,1]];
    case  6: return [[l,0, r,1]];
    case  7: return [[0,t, r,1]];
    case  8: return [[0,t, l,0]];
    case  9: return [[l,0, r,1]];
    case 10: return mid > level
               ? [[0,t, r,1],[l,0, b,0]]
               : [[0,t, l,0],[r,1, b,0]];
    case 11: return [[l,0, b,0]];
    case 12: return [[0,t, r,1]];
    case 13: return [[r,1, b,0]];
    case 14: return [[0,t, l,0]];
    default: return [];
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NeuralBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    let t = 0;

    function resize() {
      if (!canvas) return;
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    // Contour levels and their visual weights
    const levels = [
      { v: 0.30, alpha: 0.07, w: 0.6 },
      { v: 0.42, alpha: 0.10, w: 0.5 },
      { v: 0.54, alpha: 0.13, w: 0.7 },
      { v: 0.66, alpha: 0.09, w: 0.5 },
      { v: 0.78, alpha: 0.06, w: 0.4 },
    ];

    function draw() {
      if (!canvas) return;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Base background
      ctx.fillStyle = "#07090f";
      ctx.fillRect(0, 0, W, H);

      // Subtle radial centre-glow so the canvas content pops
      const cg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.65);
      cg.addColorStop(0,   "rgba(30,40,80,0.35)");
      cg.addColorStop(0.5, "rgba(10,15,35,0.20)");
      cg.addColorStop(1,   "rgba(0,0,0,0.50)");
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, W, H);

      // ── Marching-squares contours ──────────────────────────────────
      const CELL  = 22;                          // grid cell size (px)
      const cols  = Math.ceil(W / CELL) + 1;
      const rows  = Math.ceil(H / CELL) + 1;

      // Sample noise field (tiny time drift makes it animate slowly)
      const speed = 0.00012;
      const scale = 0.0038;
      const field: number[][] = [];
      for (let r = 0; r <= rows; r++) {
        field[r] = [];
        for (let c = 0; c <= cols; c++) {
          field[r][c] = fbm(c * scale + t * speed, r * scale + t * speed * 0.7);
        }
      }

      // Accent color — single blue-indigo hue, varied only in opacity
      const R = 99, G = 120, B = 230;

      for (const { v: level, alpha, w } of levels) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${R},${G},${B},${alpha})`;
        ctx.lineWidth   = w;
        ctx.lineCap     = "round";

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const px = c * CELL, py = r * CELL;

            const segs = getSegments(
              field[r][c],   field[r][c+1],
              field[r+1][c+1], field[r+1][c],
              level
            );

            for (const [x0,y0,x1,y1] of segs) {
              ctx.moveTo(px + x0 * CELL, py + y0 * CELL);
              ctx.lineTo(px + x1 * CELL, py + y1 * CELL);
            }
          }
        }
        ctx.stroke();
      }

      // ── Soft vignette ──────────────────────────────────────────────
      const vg = ctx.createRadialGradient(W/2,H/2, H*0.25, W/2,H/2, H*0.9);
      vg.addColorStop(0, "transparent");
      vg.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      t++;
      raf = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full"
      style={{ display: "block" }}
    />
  );
}
