import type { BannerParams, CanvasLike, Ctx2D, Frame, Speed } from './types';
import { FRAME_DELAY_MS } from './types';
import { TAU, clamp01, fillTextCentered, lerp, smoothstep, window01 } from './util';

const FRAMES = { wave: 24, ticker: 32, shimmer: 24, typewriter: 28, static: 1 } as const;

function base(ctx: Ctx2D, p: BannerParams): void {
  const r = Math.min(p.height * 0.18, 16);
  const path = p.env.path2d(roundedRect(0, 0, p.width, p.height, r));
  ctx.clip(path);
  const g = ctx.createLinearGradient(0, 0, p.width, 0);
  g.addColorStop(0, p.colorA);
  g.addColorStop(1, p.colorB);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, p.width, p.height);
}

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
}

function drawText(ctx: Ctx2D, p: BannerParams, dx = 0): void {
  if (!p.text) return;
  fillTextCentered(
    ctx,
    p.env,
    p.text,
    p.width / 2 + dx,
    p.height / 2,
    p.width * 0.86,
    p.height * 0.42,
    p.textColor,
  );
}

/** A rolling wave: two translucent sine layers scroll one full wavelength per loop. */
function wave(ctx: Ctx2D, p: BannerParams, t: number): void {
  base(ctx, p);
  const lambda = p.width / 2;
  const layers = [
    { amp: 0.16, base: 0.66, alpha: 0.34, dir: 1 },
    { amp: 0.12, base: 0.74, alpha: 0.5, dir: -1 },
  ];
  for (const l of layers) {
    ctx.beginPath();
    ctx.moveTo(0, p.height);
    for (let x = 0; x <= p.width; x += 4) {
      const y = p.height * l.base + Math.sin(TAU * (x / lambda + l.dir * t)) * p.height * l.amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(p.width, p.height);
    ctx.closePath();
    ctx.fillStyle = `rgba(255,255,255,${l.alpha})`;
    ctx.fill();
  }
  drawText(ctx, p);
}

/** Text that scrolls off to the left while a second copy enters from the right. */
function ticker(ctx: Ctx2D, p: BannerParams, t: number): void {
  base(ctx, p);
  if (!p.text) return wave(ctx, p, t);
  const scale = Math.min(
    (p.width * 0.86) / p.text.width,
    (p.height * 0.42) / (p.text.ascent + p.text.descent),
  );
  const textW = p.text.width * scale;
  const span = p.width + textW;
  const shift = t < 0.3 ? 0 : -smoothstep(0, 1, window01(0.3, 1, t)) * span;
  for (const dx of [shift, shift + span]) {
    if (Math.abs(dx) > span) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, p.width, p.height);
    ctx.clip();
    drawText(ctx, p, dx);
    ctx.restore();
  }
}

/** A soft highlight glides across a static gradient. */
function shimmer(ctx: Ctx2D, p: BannerParams, t: number): void {
  base(ctx, p);
  drawText(ctx, p);
  const q = window01(0.25, 0.9, t);
  if (q <= 0 || q >= 1) return;
  const bandW = p.width * 0.28;
  const x = lerp(-bandW, p.width + bandW, q);
  const g = ctx.createLinearGradient(x - bandW, 0, x + bandW, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.42)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, p.width, p.height);
}

/** Left-aligned text, clipped to a growing width so it reads as typed rather than centred. */
function drawTypedSoFar(ctx: Ctx2D, p: BannerParams, revealW: number, padX: number): void {
  const text = p.text;
  if (!text || !text.d || text.width <= 0) return;
  const maxW = p.width - padX * 2;
  const maxH = p.height * 0.55;
  const h = text.ascent + text.descent;
  const scale = Math.min(maxW / text.width, maxH / Math.max(h, 1));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, padX + revealW, p.height);
  ctx.clip();
  ctx.translate(padX, p.height / 2 + ((text.ascent - text.descent) * scale) / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = p.textColor;
  ctx.fill(p.env.path2d(text.d));
  ctx.restore();
}

/**
 * A tagline types itself out letter by letter behind a blinking cursor, then holds complete
 * (frame 1 = fully typed, per the project's "classic Outlook shows frame 1 only" rule) before
 * clearing and retyping.
 */
function typewriter(ctx: Ctx2D, p: BannerParams, t: number): void {
  base(ctx, p);
  const padX = p.width * 0.05;
  if (!p.text || p.text.width <= 0) return;
  const maxW = p.width - padX * 2;
  const h = p.text.ascent + p.text.descent;
  const scale = Math.min(maxW / p.text.width, (p.height * 0.55) / Math.max(h, 1));
  const fullW = p.text.width * scale;
  let reveal = fullW;
  let cursor = false;
  if (t >= 0.06 && t < 0.16) {
    reveal = 0;
  } else if (t >= 0.16 && t < 0.78) {
    reveal = fullW * window01(0.16, 0.78, t); // linear: a typewriter has no ease-in/out
    cursor = true;
  } else if (t >= 0.78) {
    cursor = Math.floor(t * 20) % 2 === 0; // blink while holding the complete line
  }
  drawTypedSoFar(ctx, p, reveal, padX);
  if (cursor || t < 0.06) {
    ctx.fillStyle = p.textColor;
    ctx.fillRect(
      padX + reveal + 1,
      p.height * 0.22,
      Math.max(1.5, p.width * 0.01),
      p.height * 0.56,
    );
  }
}

function stat(ctx: Ctx2D, p: BannerParams): void {
  const r = Math.min(p.height * 0.18, 16);
  ctx.clip(p.env.path2d(roundedRect(0, 0, p.width, p.height, r)));
  const img = p.image as CanvasLike | null | undefined;
  if (!img) {
    base(ctx, p);
    return;
  }
  // cover-fit
  const s = Math.max(p.width / img.width, p.height / img.height);
  const w = img.width * s;
  const h = img.height * s;
  ctx.drawImage(img as unknown as CanvasImageSource, (p.width - w) / 2, (p.height - h) / 2, w, h);
}

export function drawBanner(ctx: Ctx2D, p: BannerParams, t: number): void {
  ctx.save();
  switch (p.kind) {
    case 'wave':
      wave(ctx, p, t);
      break;
    case 'ticker':
      ticker(ctx, p, t);
      break;
    case 'shimmer':
      shimmer(ctx, p, t);
      break;
    case 'typewriter':
      typewriter(ctx, p, t);
      break;
    case 'static':
      stat(ctx, p);
      break;
  }
  ctx.restore();
}

export function bannerTimeline(kind: BannerParams['kind'], speed: Speed): Frame[] {
  const n = FRAMES[kind];
  if (n <= 1) return [{ t: 0, delayMs: 0 }];
  const delayMs = FRAME_DELAY_MS[speed];
  return Array.from({ length: n }, (_, i) => ({ t: clamp01(i / n), delayMs }));
}
