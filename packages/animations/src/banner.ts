import type { BannerParams, CanvasLike, Ctx2D, Frame, Speed } from './types';
import { FRAME_DELAY_MS } from './types';
import { TAU, clamp01, fillTextCentered, lerp, smoothstep, window01 } from './util';

const FRAMES = { wave: 24, ticker: 32, shimmer: 24, static: 1 } as const;

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
