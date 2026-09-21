import {
  paintColors,
  paintStyle,
  smoothstep,
  window01,
  type Ctx2D,
  type DrawEnv,
  type Frame,
  type Speed,
} from '@mailmotion/animations';
import { FRAME_DELAY_MS } from '@mailmotion/animations';
import type { Paint, SignatureConfig, Stroke } from '@mailmotion/schema';
import type { InkLayout } from './glyphs';

export interface InkStyle {
  color: Paint;
  /** Pen width in canvas pixels. */
  penWidth: number;
  glow: boolean;
}

export const PEN_WIDTH_1X = { thin: 1.1, medium: 1.7, bold: 2.6 } as const;

/** Text for the mark (full name, first name, initials or custom). */
export function markText(config: SignatureConfig): string {
  const name = config.details.fullName.trim();
  const words = name.split(/\s+/);
  switch (config.mark.text) {
    case 'first':
      return words[0] ?? name;
    case 'initials':
      return words
        .map((w) => w[0] ?? '')
        .join('')
        .toUpperCase();
    case 'custom':
      return config.mark.customText?.trim() || name;
    default:
      return name;
  }
}

function applyGlow(ctx: Ctx2D, style: InkStyle, blur: number): void {
  if (!style.glow) return;
  const [a] = paintColors(style.color);
  ctx.shadowColor = a;
  ctx.shadowBlur = blur;
}

/**
 * Draw typed ink at `progress` (0 = nothing, 1 = complete). Each glyph's outline is traced by a pen
 * and then filled, in reading order. Progress is distributed by outline length so the pen moves at
 * a steady speed.
 */
export function drawTypedInk(
  ctx: Ctx2D,
  env: DrawEnv,
  layout: InkLayout,
  style: InkStyle,
  progress: number,
): void {
  const { glyphs, totalLength, width, height } = layout;
  const paint = paintStyle(ctx, style.color, 0, 0, width, height);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = paint;
  ctx.fillStyle = paint;
  applyGlow(ctx, style, style.penWidth * 3);

  let cursor = 0;
  for (const g of glyphs) {
    const start = cursor / totalLength;
    cursor += g.length;
    const end = cursor / totalLength;
    const q = window01(start, end, progress);
    if (q <= 0) continue;
    const path = env.path2d(g.d);
    if (q >= 1) {
      ctx.fill(path);
      continue;
    }
    // trace the outline, then let the fill bloom in behind the pen
    const fillAlpha = smoothstep(0.5, 1, q);
    if (fillAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = fillAlpha;
      ctx.fill(path);
      ctx.restore();
    }
    ctx.lineWidth = style.penWidth;
    ctx.setLineDash([g.maxContour * q, g.maxContour * 2]);
    ctx.stroke(path);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/** Fade the finished mark in (0 = invisible, 1 = complete). */
export function drawFadeInk(
  ctx: Ctx2D,
  env: DrawEnv,
  layout: InkLayout,
  style: InkStyle,
  progress: number,
): void {
  if (progress <= 0) return;
  const paint = paintStyle(ctx, style.color, 0, 0, layout.width, layout.height);
  ctx.save();
  ctx.globalAlpha = Math.min(1, progress);
  ctx.fillStyle = paint;
  applyGlow(ctx, style, style.penWidth * 3);
  for (const g of layout.glyphs) ctx.fill(env.path2d(g.d));
  ctx.restore();
}

/** Polyline strokes in normalised 0..1 coordinates, revealed by a pen (drawn & uploaded marks). */
export function drawStrokeInk(
  ctx: Ctx2D,
  strokes: Stroke[],
  box: { x: number; y: number; width: number; height: number },
  style: InkStyle,
  progress: number,
): void {
  if (progress <= 0 || strokes.length === 0) return;
  const lens = strokes.map((s) => {
    let l = 0;
    for (let i = 1; i < s.length; i++)
      l += Math.hypot(s[i]![0] - s[i - 1]![0], s[i]![1] - s[i - 1]![1]);
    return Math.max(l, 1e-6);
  });
  const total = lens.reduce((a, b) => a + b, 0);
  const paint = paintStyle(ctx, style.color, box.x, box.y, box.x + box.width, box.y + box.height);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = paint;
  ctx.lineWidth = style.penWidth;
  applyGlow(ctx, style, style.penWidth * 3);
  const target = progress * total;
  let used = 0;
  for (let si = 0; si < strokes.length; si++) {
    const s = strokes[si]!;
    const remaining = target - used;
    if (remaining <= 0) break;
    ctx.beginPath();
    const pt = (i: number) =>
      [box.x + s[i]![0] * box.width, box.y + s[i]![1] * box.height] as const;
    ctx.moveTo(...pt(0));
    let acc = 0;
    for (let i = 1; i < s.length; i++) {
      const seg = Math.hypot(s[i]![0] - s[i - 1]![0], s[i]![1] - s[i - 1]![1]);
      if (acc + seg <= remaining) {
        ctx.lineTo(...pt(i));
        acc += seg;
      } else {
        const f = seg > 0 ? (remaining - acc) / seg : 0;
        const a = pt(i - 1);
        const b = pt(i);
        ctx.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
        break;
      }
    }
    ctx.stroke();
    used += lens[si]!;
  }
  ctx.restore();
}

export interface InkFrame extends Frame {
  /** 0 = blank, 1 = complete. NOTE: `t` mirrors `progress`; the first frame is always complete. */
  progress: number;
}

const DRAW_FRAMES: Record<Speed, number> = { slow: 28, normal: 20, fast: 14 };

/**
 * Frame list for a mark. Frame 0 is the complete mark and carries the "hold" delay, then the pen
 * redraws from blank. For finite loops a final complete frame is appended so the GIF stops on it.
 */
export function inkTimeline(opts: {
  animation: 'ink' | 'fade' | 'none';
  speed: Speed;
  holdMs: number;
  loop: 'forever' | 'three';
}): { frames: InkFrame[]; loopCount: number } {
  const step = FRAME_DELAY_MS[opts.speed];
  if (opts.animation === 'none')
    return { frames: [{ t: 1, progress: 1, delayMs: 0 }], loopCount: 0 };

  const hold = Math.max(step, opts.holdMs);
  const n = opts.animation === 'ink' ? DRAW_FRAMES[opts.speed] : 8;
  const frames: InkFrame[] = [{ t: 1, progress: 1, delayMs: hold }];
  for (let k = 0; k < n; k++) {
    const progress =
      (k + (opts.animation === 'ink' ? 0.5 : 1)) / (n + (opts.animation === 'ink' ? 1 : 1));
    frames.push({ t: progress, progress, delayMs: step });
  }
  if (opts.loop === 'three') {
    frames.push({ t: 1, progress: 1, delayMs: Math.max(hold, 2000) });
    // GIF loop counts differ between viewers (extra plays vs total plays); 2 gives 3 plays in Chrome/Firefox.
    return { frames, loopCount: 2 };
  }
  return { frames, loopCount: 0 };
}
