/**
 * Draws one frame of each design's animated slot, mirroring the reference page's CSS rule for
 * rule (sizes, offsets, keyframes, timing functions, shadows), so the hosted GIF shows what the
 * live CSS preview shows. Coordinates are CSS pixels; the caller scales the context for 2x output.
 */
import {
  EQ_BARS,
  initials,
  hostOf,
  inkIsLong,
  typedText,
  type SignetData,
  type SignetId,
} from './templates';
import { ease, easeInOut, easeOut, frac, keyframes } from './easing';

export type Ctx = CanvasRenderingContext2D;

export interface Frame {
  /** Animation time in seconds (the CSS clock, from page load). */
  t: number;
  /** How long this frame is shown, ms. */
  delayMs: number;
}

export interface SlotRenderer {
  /** The colour behind the slot in the email (the pane is white; Neon sits on its dark card). */
  background: string;
  /** Sample times for one seamless loop. The first frame is the complete, at-rest state, which is
   * all classic Outlook ever shows (the reference's "first frame only" preview). */
  frames(d: SignetData): Frame[];
  draw(ctx: Ctx, d: SignetData, accent: string, t: number, env: DrawEnv): void;
}

export interface DrawEnv {
  /** Device pixels per CSS pixel (canvas shadow blur is not affected by transforms). */
  scale: number;
  /** An offscreen canvas of the same size, for effects drawn as a group (CSS `opacity`). */
  layer: () => Ctx;
}

const STEP_MS = 100; // 10 fps: under the 12 fps budget, and delays are exact in GIF's 10ms units
const WHITE = '#ffffff';
const NEON_BG = '#0d1020';

/** Evenly spaced samples of a loop of `seconds`, starting at CSS time `start`. */
function loop(seconds: number, start = 0): Frame[] {
  const n = Math.round((seconds * 1000) / STEP_MS);
  return Array.from({ length: n }, (_, i) => ({
    t: start + (i * STEP_MS) / 1000,
    delayMs: STEP_MS,
  }));
}

/** CSS `white-space: nowrap` and SVG text both collapse runs of whitespace to one space. */
const collapse = (s: string) => s.replace(/\s+/g, ' ');

/* ------------------------------------------------------------------ text metrics */

interface Metrics {
  width: number;
  ascent: number;
  descent: number;
}

function metrics(ctx: Ctx, text: string, size: number): Metrics {
  const m = ctx.measureText(text);
  const ascent = Number.isFinite(m.fontBoundingBoxAscent) ? m.fontBoundingBoxAscent : 0.905 * size;
  const descent = Number.isFinite(m.fontBoundingBoxDescent)
    ? m.fontBoundingBoxDescent
    : 0.212 * size;
  return { width: m.width, ascent, descent };
}

/** Baseline of a line box of `lineHeight` whose top is `top` (CSS inline layout). */
function baselineIn(top: number, lineHeight: number, m: Metrics): number {
  return top + (lineHeight - (m.ascent + m.descent)) / 2 + m.ascent;
}

/** Baseline for text vertically centred on `cy` (grid/flex centring of a single line). */
function centredBaseline(cy: number, m: Metrics): number {
  return cy + (m.ascent - m.descent) / 2;
}

/** Arial's `line-height: normal` (ascent + descent + line gap), as a fraction of the font size. */
const NORMAL_LH = 1.149;

function fillCentred(ctx: Ctx, text: string, cx: number, cy: number, size: number) {
  const m = metrics(ctx, text, size);
  ctx.fillText(text, cx - m.width / 2, centredBaseline(cy, m));
}

/* ------------------------------------------------------------------ shapes */

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function circle(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: [number, number, number], b: [number, number, number], t: number) {
  return a.map((v, i) => Math.round(v + (b[i]! - v) * t)) as [number, number, number];
}

/** `conic-gradient(...)` filling a circle; CSS 0deg is up, canvas 0 is right. */
function conicCircle(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  colors: string[],
  rotation: number,
) {
  // rotate the drawing rather than the gradient's start angle (some canvases ignore the angle)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  const start = -Math.PI / 2;
  const withConic = ctx as Ctx & {
    createConicGradient?: (a: number, x: number, y: number) => CanvasGradient;
  };
  if (typeof withConic.createConicGradient === 'function') {
    const g = withConic.createConicGradient(start, 0, 0);
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = g;
    circle(ctx, 0, 0, r);
    ctx.fill();
    ctx.restore();
    return;
  }
  // fallback: thin wedges, colour interpolated like the gradient
  const rgb = colors.map(hexToRgb);
  const N = 360;
  for (let i = 0; i < N; i++) {
    const p = i / N;
    const seg = Math.min(colors.length - 2, Math.floor(p * (colors.length - 1)));
    const local = p * (colors.length - 1) - seg;
    const [cr, cg, cb] = mix(rgb[seg]!, rgb[seg + 1]!, local);
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
    const a0 = start + (i / N) * Math.PI * 2;
    const a1 = start + ((i + 1.5) / N) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ 1. aurora (88×88) */
// .a-aurora::before{inset:0;border-radius:50%;conic-gradient(acc,#7C5CFF,#22D3EE,acc);spin 3s linear}
// .a-aurora b{inset:5px;border-radius:50%;background:#fff;font:700 26px Arial;color:acc}
const aurora: SlotRenderer = {
  background: WHITE,
  frames: () => loop(3),
  draw(ctx, d, a, t) {
    conicCircle(ctx, 44, 44, 44, [a, '#7C5CFF', '#22D3EE', a], Math.PI * 2 * frac(t / 3));
    ctx.fillStyle = WHITE;
    circle(ctx, 44, 44, 39);
    ctx.fill();
    ctx.fillStyle = a;
    ctx.font = 'bold 26px Arial, Helvetica, sans-serif';
    fillCentred(ctx, collapse(initials(d.name)), 44, 44, 26);
  },
};

/* ------------------------------------------------------------------ 2. pulse (80×80) */
// .a-pulse b{58×58 circle, centred; background:acc; color:#fff; font:700 21px Arial; z-index:1}
// .a-pulse::after{left:11px;top:11px;54×54 (border-box);border:2px solid acc;
//   pulse 1.8s ease-out: 0% scale(.95) opacity .8 → 100% scale(1.35) opacity 0}
const pulse: SlotRenderer = {
  background: WHITE,
  frames: () => loop(1.8),
  draw(ctx, d, a, t) {
    const p = easeOut(frac(t / 1.8));
    const s = 0.95 + (1.35 - 0.95) * p;
    const o = 0.8 * (1 - p);
    // the ring sits under the disc (the disc has z-index 1), concentric with it
    if (o > 0) {
      ctx.save();
      ctx.globalAlpha = o;
      ctx.strokeStyle = a;
      ctx.lineWidth = 2 * s;
      circle(ctx, 40, 40, 26 * s);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = a;
    circle(ctx, 40, 40, 29);
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.font = 'bold 21px Arial, Helvetica, sans-serif';
    fillCentred(ctx, initials(d.name), 40, 40, 21);
  },
};

/* ------------------------------------------------------------------ 3. typewriter (340×22) */
// .a-type{width:var(--w) (= len ch);border-right:2px solid acc;font:13px/22px "Courier New";
//   type 5s steps(len,end): 0% width 0 → 55%,100% width var(--w); blink .7s step-end: 50% transparent}
const TYPE_LOOP = 5;
const BLINK = TYPE_LOOP / 7; // .7s in the reference; 5/7s here so both loops close in one 5s GIF
const typewriter: SlotRenderer = {
  background: WHITE,
  // start fully typed with the cursor showing (4 whole blinks in), i.e. the static preview
  frames: () => loop(TYPE_LOOP, 4 * BLINK),
  draw(ctx, d, a, t) {
    const raw = typedText(d);
    const text = collapse(raw);
    const n = Math.max(raw.length, 1);
    ctx.font = '13px "Courier New", Courier, monospace';
    const ch = ctx.measureText('0').width;
    const full = raw.length * ch; // `--w: <length>ch` counts the uncollapsed text
    const p = frac(t / TYPE_LOOP);
    const w = p < 0.55 ? (Math.floor((p / 0.55) * n) / n) * full : full;
    const box = Math.max(w, 2); // border-box: the 2px border is always there
    const m = metrics(ctx, text || 'x', 13);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, box - 2, 22);
    ctx.clip();
    ctx.fillStyle = '#16213a';
    ctx.fillText(text, 0, baselineIn(0, 22, m));
    ctx.restore();
    if (frac(t / BLINK) < 0.5) {
      ctx.fillStyle = a;
      ctx.fillRect(box - 2, 0, 2, 22);
    }
  },
};

/* ------------------------------------------------------------------ 4. wave (460×56) */
// .a-wave{inset:0;background:acc;border-radius:6px}; two 920×56 svgs slide -460px:
//   .w1 path(36) #fff .22, 6s linear; .w2 path(42) #fff .16, 9s linear reverse
// b{left:16px;top:17px;font:700 16px Arial;#fff}; i{right:16px;top:19px;font:normal 12px Arial;#fff;opacity:.9}
function wavePath(ctx: Ctx, y: number, dx: number) {
  ctx.beginPath();
  ctx.moveTo(dx, y);
  // M0 y Q115 y-18 230 y T460 y T690 y T920 y V56 H0 Z — each T reflects the previous control point
  let cpx = 115;
  let cpy = y - 18;
  ctx.quadraticCurveTo(dx + cpx, cpy, dx + 230, y);
  for (const x of [460, 690, 920]) {
    const prevX = x - 230;
    cpx = 2 * prevX - cpx;
    cpy = 2 * y - cpy;
    ctx.quadraticCurveTo(dx + cpx, cpy, dx + x, y);
  }
  ctx.lineTo(dx + 920, 56);
  ctx.lineTo(dx, 56);
  ctx.closePath();
}

const wave: SlotRenderer = {
  background: WHITE,
  frames: () => loop(18), // 18s = both slides (6s, 9s) back in phase
  draw(ctx, d, a, t) {
    ctx.fillStyle = a;
    roundRect(ctx, 0, 0, 460, 56, 6);
    ctx.fill();
    wavePath(ctx, 36, -460 * frac(t / 6));
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    wavePath(ctx, 42, -460 * (1 - frac(t / 9)));
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();

    ctx.font = 'bold 16px Arial, Helvetica, sans-serif';
    ctx.fillStyle = WHITE;
    const company = collapse(d.company);
    const bm = metrics(ctx, company || 'x', 16);
    ctx.fillText(company, 16, baselineIn(17, 16 * NORMAL_LH, bm));
    ctx.font = '12px Arial, Helvetica, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const host = collapse(hostOf(d.website));
    const im = metrics(ctx, host || 'x', 12);
    ctx.fillText(host, 460 - 16 - im.width, baselineIn(19, 12 * NORMAL_LH, im));
  },
};

/* ------------------------------------------------------------------ 5. neon (72×72, on #0d1020) */
// .a-neon{inset:4px;border:2px solid acc;border-radius:14px;background:#0D1020;
//   font:700 26px Arial;color:#fff;text-shadow:0 0 6px acc,0 0 14px acc;
//   box-shadow:0 0 10px acc,inset 0 0 10px acc; flicker 3.2s ease:
//   0,18,22,54,58,100% opacity 1; 20%,56% opacity .35}
const neonOpacity = keyframes(
  [
    [0, 1],
    [0.18, 1],
    [0.2, 0.35],
    [0.22, 1],
    [0.54, 1],
    [0.56, 0.35],
    [0.58, 1],
    [1, 1],
  ],
  ease,
);
const NEON_LOOP = 3.2;
const neon: SlotRenderer = {
  background: NEON_BG,
  // hold lit, the two dips at 20% and 56% (each spans 18–22% / 54–58%, 128ms), back to lit
  frames: () => {
    const at = (o: number) => o * NEON_LOOP;
    const cut = [0, 0.18, 0.22, 0.54, 0.58, 1];
    const samples = [0, 0.2, 0.22, 0.56, 0.58];
    return samples.map((s, i) => ({
      t: at(s),
      delayMs: Math.round((at(cut[i + 1]!) - at(cut[i]!)) * 1000),
    }));
  },
  draw(ctx, d, a, t, env) {
    const o = neonOpacity(frac(t / NEON_LOOP));
    const g = env.layer();
    const k = env.scale;
    // outer glow: the box's own background hides the part of the shadow under it
    g.save();
    g.shadowColor = a;
    g.shadowBlur = 10 * k;
    g.fillStyle = NEON_BG;
    roundRect(g, 4, 4, 64, 64, 14);
    g.fill();
    g.restore();
    g.fillStyle = NEON_BG;
    roundRect(g, 4, 4, 64, 64, 14);
    g.fill();
    // inset glow: shadow of everything outside the padding box, clipped to the padding box
    g.save();
    roundRect(g, 6, 6, 60, 60, 12);
    g.clip();
    g.shadowColor = a;
    g.shadowBlur = 10 * k;
    g.beginPath();
    g.rect(-100, -100, 272, 272);
    g.moveTo(18, 6);
    g.arcTo(6, 6, 6, 18, 12);
    g.lineTo(6, 54);
    g.arcTo(6, 66, 18, 66, 12);
    g.lineTo(54, 66);
    g.arcTo(66, 66, 66, 54, 12);
    g.lineTo(66, 18);
    g.arcTo(66, 6, 54, 6, 12);
    g.closePath();
    g.fillStyle = a;
    g.fill('evenodd');
    g.restore();
    // border
    g.strokeStyle = a;
    g.lineWidth = 2;
    roundRect(g, 5, 5, 62, 62, 13);
    g.stroke();
    // text with two glow layers (the last-listed shadow paints lowest)
    g.font = 'bold 26px Arial, Helvetica, sans-serif';
    g.fillStyle = WHITE;
    const text = initials(d.company);
    for (const blur of [14, 6, 0]) {
      g.save();
      if (blur) {
        g.shadowColor = a;
        g.shadowBlur = blur * k;
      }
      fillCentred(g, text, 36, 36, 26);
      g.restore();
    }
    ctx.save();
    ctx.globalAlpha = o;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(g.canvas as CanvasImageSource, 0, 0);
    ctx.restore();
  },
};

/* ------------------------------------------------------------------ 6. shimmer (300×44) */
// .a-shim{inset:0;background:acc;border-radius:6px;display:flex;align-items:center;padding:0 16px;
//   font:700 17px Arial;letter-spacing:.03em;color:#fff;overflow:hidden;white-space:nowrap}
// ::after{top:0;bottom:0;left:-90px;width:60px;linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent);
//   skewX(-20deg); sweep 3s ease-in-out: 0% left -90px → 45%,100% left 340px}
const shimmerLeft = keyframes(
  [
    [0, -90],
    [0.45, 340],
    [1, 340],
  ],
  easeInOut,
);
const shimmer: SlotRenderer = {
  background: WHITE,
  frames: () => loop(3),
  draw(ctx, d, a, t) {
    ctx.save();
    roundRect(ctx, 0, 0, 300, 44, 6);
    ctx.fillStyle = a;
    ctx.fill();
    ctx.clip();
    ctx.font = 'bold 17px Arial, Helvetica, sans-serif';
    ctx.fillStyle = WHITE;
    const spacing = 0.03 * 17;
    const company = collapse(d.company);
    const m = metrics(ctx, company || 'x', 17);
    fillSpaced(ctx, company, 16, centredBaseline(22, m), spacing);

    const left = shimmerLeft(frac(t / 3));
    ctx.translate(left + 30, 22);
    ctx.transform(1, 0, Math.tan((-20 * Math.PI) / 180), 1, 0, 0);
    const g = ctx.createLinearGradient(-30, 0, 30, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-30, -22, 60, 44);
    ctx.restore();
  },
};

/** Text with CSS `letter-spacing` (space after every character). */
function fillSpaced(ctx: Ctx, text: string, x: number, y: number, spacing: number) {
  const c = ctx as Ctx & { letterSpacing?: string };
  if (typeof c.letterSpacing === 'string') {
    const prev = c.letterSpacing;
    c.letterSpacing = `${spacing}px`;
    ctx.fillText(text, x, y);
    c.letterSpacing = prev;
    return;
  }
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

/* ------------------------------------------------------------------ 7. orbit (84×84) */
// ::before{inset:6px;border-radius:50%;border:1px dashed acc;opacity:.5}
// b{left:20px;top:20px;44×44 circle;background:acc;#fff;font:700 16px Arial}
// .s1{inset:6px;spin 4s linear} dot 8×8 acc on top; .s2{inset:14px;spin 2.6s linear reverse} dot 6×6 #22B8CF
const ORBIT_LOOP = 8; // s1: 2 turns (4s each); s2: 3 turns (2.667s each vs 2.6s — 2.5% slower) so the loop closes
const orbit: SlotRenderer = {
  background: WHITE,
  frames: () => loop(ORBIT_LOOP),
  draw(ctx, d, a, t) {
    const r = 35.5;
    const dashes = Math.round((2 * Math.PI * r) / 6);
    const dash = (2 * Math.PI * r) / (2 * dashes);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = a;
    ctx.lineWidth = 1;
    ctx.setLineDash([dash, dash]);
    ctx.beginPath();
    // @napi-rs/canvas silently draws nothing for a negative start angle, even though
    // this span is a full circle — use the equivalent (0, 2π) form instead.
    ctx.arc(42, 42, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = a;
    circle(ctx, 42, 42, 22);
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.font = 'bold 16px Arial, Helvetica, sans-serif';
    fillCentred(ctx, initials(d.company), 42, 42, 16);

    const dot = (angle: number, radius: number, size: number, color: string) => {
      ctx.fillStyle = color;
      circle(ctx, 42 + radius * Math.sin(angle), 42 - radius * Math.cos(angle), size / 2);
      ctx.fill();
    };
    dot(Math.PI * 2 * frac((t / ORBIT_LOOP) * 2), 36, 8, a);
    dot(-Math.PI * 2 * frac((t / ORBIT_LOOP) * 3), 28, 6, '#22B8CF');
  },
};

/* ------------------------------------------------------------------ 8. ticker (460×28) */
// .a-tick{inset:0;background:acc;border-radius:4px;overflow:hidden}
// span{font:700 12px/28px Arial;#fff;nowrap; tick 16s linear: translateX(0 → -50%)}; em{opacity:.7;padding:0 12px}
// content: (✦ tagline ✦ host) × 8
const ticker: SlotRenderer = {
  background: WHITE,
  frames: () => loop(16),
  draw(ctx, d, a, t) {
    ctx.save();
    roundRect(ctx, 0, 0, 460, 28, 4);
    ctx.fillStyle = a;
    ctx.fill();
    ctx.clip();
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
    const star = '✦';
    const host = collapse(hostOf(d.website));
    const runs: { text: string; faded: boolean; pad: number }[] = [
      { text: star, faded: true, pad: 12 },
      { text: collapse(d.tagline), faded: false, pad: 0 },
      { text: star, faded: true, pad: 12 },
      { text: host, faded: false, pad: 0 },
    ];
    const widths = runs.map((r) => ctx.measureText(r.text).width + r.pad * 2);
    const item = widths.reduce((s, w) => s + w, 0);
    const half = item * 4;
    const m = metrics(ctx, 'x', 12);
    const y = baselineIn(0, 28, m);
    let x = -half * frac(t / 16);
    for (let rep = 0; rep < 8 && x < 460; rep++) {
      runs.forEach((r, i) => {
        const w = widths[i]!;
        if (x + w > 0 && x < 460) {
          ctx.fillStyle = r.faded ? 'rgba(255,255,255,0.7)' : WHITE;
          ctx.fillText(r.text, x + r.pad, y);
        }
        x += w;
      });
    }
    ctx.restore();
  },
};

/* ------------------------------------------------------------------ 9. equalizer (64×64) */
// .a-eq{inset:0;background:acc;border-radius:14px;flex;align-items:flex-end;justify-content:center;gap:5px;padding-bottom:14px}
// i{width:6px;#fff;border-radius:3px;origin bottom; eq .9s ease-in-out infinite alternate: scaleY .3 → 1}
// delays: 0, -.3s, -.6s, -.15s, -.45s
const EQ_DELAY = [0, 0.3, 0.6, 0.15, 0.45];
const equalizer: SlotRenderer = {
  background: WHITE,
  frames: () => loop(1.8), // one there-and-back cycle
  draw(ctx, _d, a, t) {
    ctx.fillStyle = a;
    roundRect(ctx, 0, 0, 64, 64, 14);
    ctx.fill();
    const total = EQ_BARS.length * 6 + (EQ_BARS.length - 1) * 5;
    let x = (64 - total) / 2;
    ctx.fillStyle = WHITE;
    EQ_BARS.forEach((h, i) => {
      const tau = t + EQ_DELAY[i]!;
      const cycle = Math.floor(tau / 0.9);
      const p = frac(tau / 0.9);
      const directed = cycle % 2 === 0 ? p : 1 - p;
      const s = 0.3 + 0.7 * easeInOut(directed);
      ctx.save();
      ctx.translate(x, 64 - 14);
      ctx.scale(1, s);
      roundRect(ctx, 0, -h, 6, h, 3);
      ctx.fill();
      ctx.restore();
      x += 6 + 5;
    });
  },
};

/* ------------------------------------------------------------------ 10. ink (260×64) */
// <text x=4 y=48 font-size=46 fill=acc stroke=acc stroke-width=1.2> in Caveat 600
// stroke-dasharray:700; ink 4.5s ease-in-out: 0% offset 700, fill-opacity 0 → 50% offset 0, fill 0
//   → 70%,100% offset 0, fill 1. Names over 15 characters: textLength 248.
const INK_LOOP = 4.5;
const inkOffset = keyframes(
  [
    [0, 700],
    [0.5, 0],
    [1, 0],
  ],
  easeInOut,
);
const inkFill = keyframes(
  [
    [0, 0],
    [0.5, 0],
    [0.7, 1],
    [1, 1],
  ],
  easeInOut,
);
export const INK_FONT = '600 46px Caveat, "Segoe Script", "Brush Script MT", cursive';
const ink: SlotRenderer = {
  background: WHITE,
  frames: () => loop(INK_LOOP, 0.7 * INK_LOOP), // start fully inked
  draw(ctx, d, a, t) {
    const p = frac(t / INK_LOOP);
    ctx.save();
    ctx.font = INK_FONT;
    const name = collapse(d.name);
    ctx.translate(4, 48);
    if (inkIsLong(d)) {
      const w = ctx.measureText(name).width;
      if (w > 0) ctx.scale(248 / w, 1);
    }
    const f = inkFill(p);
    if (f > 0) {
      ctx.globalAlpha = f;
      ctx.fillStyle = a;
      ctx.fillText(name, 0, 0);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = a;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([700, 700]);
    ctx.lineDashOffset = inkOffset(p);
    ctx.strokeText(name, 0, 0);
    ctx.restore();
  },
};

export const RENDERERS: Record<SignetId, SlotRenderer> = {
  aurora,
  pulse,
  typewriter,
  wave,
  neon,
  shimmer,
  orbit,
  ticker,
  equalizer,
  ink,
};

/** Bump when drawing changes, so previously uploaded GIFs are not reused. */
export const RENDER_VERSION = 3;

/**
 * Identifies one rendered GIF: the design, the accent, and only the inputs that design actually
 * draws — editing the job title never forces re-uploading an image that doesn't show it.
 */
export function slotKey(id: SignetId, d: SignetData, accent: string): string {
  const drawn: Record<SignetId, string[]> = {
    aurora: [initials(d.name)],
    pulse: [initials(d.name)],
    typewriter: [typedText(d)],
    wave: [d.company, hostOf(d.website)],
    neon: [initials(d.company)],
    shimmer: [d.company],
    orbit: [initials(d.company)],
    ticker: [d.tagline, hostOf(d.website)],
    equalizer: [],
    ink: [d.name],
  };
  return JSON.stringify([RENDER_VERSION, id, accent.toLowerCase(), ...drawn[id]]);
}
