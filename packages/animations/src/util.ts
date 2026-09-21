import type { Paint } from '@mailmotion/schema';
import type { Ctx2D, DrawEnv, Shape, TextPath } from './types';

export const TAU = Math.PI * 2;
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 at a, 1 at b, smooth in between. */
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Progress of `v` through the window [a, b], clamped to 0..1. */
export const window01 = (a: number, b: number, v: number) => clamp01((v - a) / (b - a));

export interface Outline {
  d: string;
  /** Perimeter length, for dash-based progressive stroking. */
  length: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A closed shape outline in the box (x, y, w, h). The path starts at top-centre and runs clockwise,
 * so a dash reveal sweeps from 12 o'clock.
 */
export function outline(shape: Shape, x: number, y: number, w: number, h: number): Outline {
  if (shape === 'circle') {
    const r = Math.min(w, h) / 2;
    const cx = x + w / 2;
    const cy = y + h / 2;
    return {
      d: `M${r2(cx)} ${r2(cy - r)}A${r2(r)} ${r2(r)} 0 1 1 ${r2(cx)} ${r2(cy + r)}A${r2(r)} ${r2(r)} 0 1 1 ${r2(cx)} ${r2(cy - r)}Z`,
      length: TAU * r,
    };
  }
  if (shape === 'squircle') {
    const pts: [number, number][] = [];
    const n = 4;
    const N = 96;
    const a = w / 2;
    const b = h / 2;
    const cx = x + a;
    const cy = y + b;
    for (let i = 0; i < N; i++) {
      const th = -Math.PI / 2 + (i / N) * TAU;
      const c = Math.cos(th);
      const s = Math.sin(th);
      pts.push([
        cx + a * Math.sign(c) * Math.abs(c) ** (2 / n),
        cy + b * Math.sign(s) * Math.abs(s) ** (2 / n),
      ]);
    }
    let len = 0;
    for (let i = 0; i < N; i++) {
      const p = pts[i]!;
      const q = pts[(i + 1) % N]!;
      len += Math.hypot(q[0] - p[0], q[1] - p[1]);
    }
    return {
      d: `M${pts.map(([px, py]) => `${r2(px)} ${r2(py)}`).join('L')}Z`,
      length: len,
    };
  }
  const r = shape === 'rounded' ? Math.min(w, h) * 0.22 : 0;
  const right = x + w;
  const bottom = y + h;
  const d =
    `M${r2(x + w / 2)} ${r2(y)}H${r2(right - r)}` +
    (r ? `A${r2(r)} ${r2(r)} 0 0 1 ${r2(right)} ${r2(y + r)}` : '') +
    `V${r2(bottom - r)}` +
    (r ? `A${r2(r)} ${r2(r)} 0 0 1 ${r2(right - r)} ${r2(bottom)}` : '') +
    `H${r2(x + r)}` +
    (r ? `A${r2(r)} ${r2(r)} 0 0 1 ${r2(x)} ${r2(bottom - r)}` : '') +
    `V${r2(y + r)}` +
    (r ? `A${r2(r)} ${r2(r)} 0 0 1 ${r2(x + r)} ${r2(y)}` : '') +
    `Z`;
  return { d, length: 2 * (w - 2 * r) + 2 * (h - 2 * r) + TAU * r };
}

/** Fill/stroke style from a paint (solid colour or two-stop gradient across the box). */
export function paintStyle(
  ctx: Ctx2D,
  paint: Paint,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): string | CanvasGradient {
  if (typeof paint === 'string') return paint;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, paint.from);
  g.addColorStop(1, paint.to);
  return g;
}

export const paintColors = (paint: Paint): [string, string] =>
  typeof paint === 'string' ? [paint, paint] : [paint.from, paint.to];

/** Fill a `TextPath` centred in the box, scaled so it fits `maxW` x `maxH`. */
export function fillTextCentered(
  ctx: Ctx2D,
  env: DrawEnv,
  text: TextPath,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  color: string,
): void {
  if (!text.d || text.width <= 0) return;
  const h = text.ascent + text.descent;
  const scale = Math.min(maxW / text.width, maxH / Math.max(h, 1));
  ctx.save();
  ctx.translate(cx - (text.width * scale) / 2, cy + ((text.ascent - text.descent) * scale) / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.fill(env.path2d(text.d));
  ctx.restore();
}
