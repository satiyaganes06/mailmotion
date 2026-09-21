import { mix, readableOn } from '@mailmotion/contrast';
import type { AvatarAnimationId } from '@mailmotion/schema';
import type { AvatarAnimation, AvatarParams, Ctx2D, Frame, Speed } from './types';
import { FRAME_DELAY_MS } from './types';
import {
  TAU,
  fillTextCentered,
  lerp,
  outline,
  paintColors,
  paintStyle,
  smoothstep,
  window01,
} from './util';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const boxOf = (size: number, inset: number): Box => ({
  x: inset,
  y: inset,
  w: size - inset * 2,
  h: size - inset * 2,
});

/** The avatar body (photo, or gradient + initials) clipped to the shape, inside `box`. */
function drawBody(ctx: Ctx2D, p: AvatarParams, box: Box, bg?: string): void {
  const o = outline(p.shape, box.x, box.y, box.w, box.h);
  const path = p.env.path2d(o.d);
  ctx.save();
  ctx.clip(path);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  if (p.image) {
    ctx.drawImage(p.image as unknown as CanvasImageSource, box.x, box.y, box.w, box.h);
  } else {
    if (!bg) {
      const [a, b] = [p.accent, p.secondary];
      const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
      g.addColorStop(0, a);
      g.addColorStop(1, b);
      ctx.fillStyle = g;
      ctx.fillRect(box.x, box.y, box.w, box.h);
    }
    if (p.initials) {
      const fg = bg ? '#ffffff' : readableOn(p.accent);
      fillTextCentered(
        ctx,
        p.env,
        p.initials,
        box.x + box.w / 2,
        box.y + box.h / 2,
        box.w * 0.52,
        box.h * 0.34,
        fg,
      );
    }
  }
  ctx.restore();
}

function strokeOutline(
  ctx: Ctx2D,
  p: AvatarParams,
  box: Box,
  width: number,
  style: string | CanvasGradient,
): void {
  ctx.save();
  ctx.lineWidth = width;
  ctx.strokeStyle = style;
  ctx.stroke(p.env.path2d(outline(p.shape, box.x, box.y, box.w, box.h).d));
  ctx.restore();
}

/* ------------------------------------------------------------------ aurora */

const aurora: AvatarAnimation = {
  frames: 24,
  draw(ctx, p, t) {
    const ringW = p.size * 0.07;
    const inset = ringW * 1.7;
    drawBody(ctx, p, boxOf(p.size, inset));
    // Complete (t = 0) -> reset -> sweep round -> complete.
    let prog = 1;
    if (t >= 0.3 && t < 0.38) prog = 0;
    else if (t >= 0.38 && t < 0.85) prog = smoothstep(0, 1, window01(0.38, 0.85, t));
    const ringBox = boxOf(p.size, ringW / 2);
    const o = outline(p.shape, ringBox.x, ringBox.y, ringBox.w, ringBox.h);
    const stroke = paintStyle(ctx, p.ring, 0, 0, p.size, p.size);
    ctx.save();
    ctx.lineWidth = ringW;
    // GIF has 1-bit alpha, so the faint track is a solid tint rather than a translucent stroke.
    const [ca, cb] = paintColors(p.ring);
    ctx.strokeStyle = mix(mix(ca, cb, 0.5), '#ffffff', 0.82);
    ctx.stroke(p.env.path2d(o.d));
    ctx.strokeStyle = stroke;
    if (prog > 0) {
      if (prog < 0.999) ctx.setLineDash([o.length * prog, o.length * 2]);
      ctx.lineCap = prog < 0.999 ? 'round' : 'butt';
      ctx.stroke(p.env.path2d(o.d));
    }
    ctx.restore();
  },
};

/* ------------------------------------------------------------------ strip-reveal */

const stripReveal: AvatarAnimation = {
  frames: 20,
  draw(ctx, p, t) {
    const box = boxOf(p.size, 0);
    drawBody(ctx, p, box);
    // A diagonal band sweeps in to cover the picture, then sweeps out to reveal it again.
    const k = 0.5;
    const w = p.size;
    const h = p.size;
    const min = -k * h - 2;
    const max = w + k * h + 2;
    let front = min;
    let back = min;
    if (t >= 0.5 && t < 0.72) front = lerp(min, max, smoothstep(0, 1, window01(0.5, 0.72, t)));
    else if (t >= 0.72 && t < 0.78) front = max;
    else if (t >= 0.78) {
      front = max;
      back = lerp(min, max, smoothstep(0, 1, window01(0.78, 1, t)));
    }
    if (front <= min + 0.5 || back >= max - 0.5) return; // nothing covered
    ctx.save();
    ctx.clip(p.env.path2d(outline(p.shape, 0, 0, w, h).d));
    ctx.fillStyle = paintStyle(ctx, p.ring, 0, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(back, 0);
    ctx.lineTo(front, 0);
    ctx.lineTo(front - k * h, h);
    ctx.lineTo(back - k * h, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
};

/* ------------------------------------------------------------------ pulse */

const pulse: AvatarAnimation = {
  frames: 20,
  draw(ctx, p, t) {
    const inset = p.size * 0.15;
    const inner = boxOf(p.size, inset);
    drawBody(ctx, p, inner);
    const style = paintStyle(ctx, p.ring, 0, 0, p.size, p.size);
    strokeOutline(ctx, p, inner, p.size * 0.022, style);
    if (t > 0.08 && t < 0.92) {
      const q = window01(0.08, 0.92, t);
      const grow = lerp(0, inset - p.size * 0.012, q);
      const box = boxOf(p.size, inset - grow);
      // thin out instead of fading: translucent pixels would be dropped by GIF's 1-bit alpha
      strokeOutline(ctx, p, box, Math.max(0.6, p.size * 0.03 * (1 - q)), style);
    }
  },
};

/* ------------------------------------------------------------------ neon */

const neon: AvatarAnimation = {
  frames: 16,
  draw(ctx, p, t) {
    const inset = p.size * 0.17;
    const box = boxOf(p.size, inset);
    drawBody(ctx, p, box, '#0b0a14');
    const [a, b] = paintColors(p.ring);
    const intensity = 0.62 + 0.38 * Math.cos(TAU * t); // t = 0 is fully lit
    ctx.save();
    ctx.lineWidth = p.size * 0.028;
    ctx.strokeStyle = paintStyle(ctx, p.ring, 0, 0, p.size, p.size);
    const path = p.env.path2d(outline(p.shape, box.x, box.y, box.w, box.h).d);
    ctx.shadowColor = a;
    ctx.shadowBlur = p.size * 0.1 * intensity;
    ctx.stroke(path);
    ctx.shadowColor = b;
    ctx.shadowBlur = p.size * 0.2 * intensity;
    ctx.stroke(path);
    ctx.restore();
  },
};

/* ------------------------------------------------------------------ orbit */

const orbit: AvatarAnimation = {
  frames: 24,
  draw(ctx, p, t) {
    const ringW = p.size * 0.07;
    drawBody(ctx, p, boxOf(p.size, ringW * 1.7));
    const rb = boxOf(p.size, ringW / 2);
    const o = outline(p.shape, rb.x, rb.y, rb.w, rb.h);
    const path = p.env.path2d(o.d);
    const [ca, cb] = paintColors(p.ring);
    const N = 48;
    const seg = o.length / N;
    ctx.save();
    ctx.lineWidth = ringW;
    for (let i = 0; i < N; i++) {
      const pos = (i / N + t) % 1;
      const tri = pos < 0.5 ? pos * 2 : (1 - pos) * 2;
      ctx.strokeStyle = mixHex(ca, cb, tri);
      ctx.setLineDash([seg + 0.6, o.length]);
      ctx.lineDashOffset = -i * seg;
      ctx.stroke(path);
    }
    ctx.restore();
  },
};

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(lerp(v, pb[i]!, t)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* ------------------------------------------------------------------ equalizer */

const BARS = [
  { h: 0.14, f: 1 },
  { h: 0.1, f: 2 },
  { h: 0.2, f: 1 },
  { h: 0.09, f: 3 },
  { h: 0.16, f: 2 },
];

const equalizer: AvatarAnimation = {
  frames: 12,
  draw(ctx, p, t) {
    const box = boxOf(p.size, p.size * 0.02);
    drawBody(ctx, p, box);
    // A gradient tint under the bars keeps them readable on photos.
    ctx.save();
    ctx.clip(p.env.path2d(outline(p.shape, box.x, box.y, box.w, box.h).d));
    const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
    g.addColorStop(0.45, 'rgba(0,0,0,0)');
    g.addColorStop(1, p.image ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.18)');
    ctx.fillStyle = g;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    const bw = p.size * 0.06;
    const gap = p.size * 0.045;
    const total = BARS.length * bw + (BARS.length - 1) * gap;
    let x = (p.size - total) / 2;
    const base = p.size * 0.86;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    for (const bar of BARS) {
      const rest = 0.4; // t = 0: bars at rest
      const s = rest + (1 - rest) * ((1 - Math.cos(TAU * bar.f * t)) / 2);
      const h = bar.h * p.size * s + p.size * 0.02;
      ctx.beginPath();
      ctx.roundRect(x, base - h, bw, h, bw / 2);
      ctx.fill();
      x += bw + gap;
    }
    ctx.restore();
  },
};

/* ------------------------------------------------------------------ static */

const none: AvatarAnimation = {
  frames: 1,
  draw(ctx, p) {
    drawBody(ctx, p, boxOf(p.size, 0));
  },
};

export const AVATAR_ANIMATION_DEFS: Record<AvatarAnimationId, AvatarAnimation> = {
  aurora,
  'strip-reveal': stripReveal,
  pulse,
  neon,
  orbit,
  equalizer,
  none,
};

export function avatarTimeline(id: AvatarAnimationId, speed: Speed): Frame[] {
  const def = AVATAR_ANIMATION_DEFS[id];
  if (def.frames <= 1) return [{ t: 0, delayMs: 0 }];
  const delayMs = FRAME_DELAY_MS[speed];
  return Array.from({ length: def.frames }, (_, i) => ({ t: i / def.frames, delayMs }));
}
