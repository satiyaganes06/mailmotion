import type { PlatformId } from '@mailmotion/schema';
import { GLYPHS } from './glyphs';

/** Minimal drawing surface (same structural types as the animations package). */
type Ctx = CanvasRenderingContext2D;
interface Env {
  path2d(d: string): Path2D;
}
type Img = { width: number; height: number };

export type IconStyle = 'filled' | 'outline' | 'circle' | 'square';

export interface IconOptions {
  platform: PlatformId;
  style: IconStyle;
  /** Colour of the glyph (filled/outline) or of the badge (circle/square). */
  color: string;
  /** Glyph colour on a badge. */
  badgeGlyph: string;
  /** Uploaded artwork for `custom` links (drawn instead of the glyph). */
  image?: Img | null;
}

/** Draw an icon filling the canvas box `px x px`. Transparent outside the badge/glyph. */
export function drawIcon(ctx: Ctx, env: Env, px: number, o: IconOptions): void {
  ctx.clearRect(0, 0, px, px);
  ctx.save();
  const badge = o.style === 'circle' || o.style === 'square';
  if (badge) {
    ctx.fillStyle = o.color;
    if (o.style === 'circle') {
      ctx.beginPath();
      ctx.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.roundRect(0, 0, px, px, px * 0.22);
      ctx.fill();
    }
  }

  // glyph box inside the canvas
  const pad = badge ? px * 0.24 : px * 0.06;
  const box = px - pad * 2;

  if (o.image) {
    const s = Math.min(box / o.image.width, box / o.image.height);
    const w = o.image.width * s;
    const h = o.image.height * s;
    ctx.drawImage(o.image as unknown as CanvasImageSource, (px - w) / 2, (px - h) / 2, w, h);
    ctx.restore();
    return;
  }

  ctx.translate(pad, pad);
  ctx.scale(box / 24, box / 24);
  const glyphColor = badge ? o.badgeGlyph : o.color;
  ctx.fillStyle = glyphColor;
  ctx.strokeStyle = glyphColor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const g of GLYPHS[o.platform]) {
    const path = env.path2d(g.d);
    if (g.mode === 'stroke') {
      ctx.lineWidth = 1.8;
      ctx.stroke(path);
    } else if (o.style === 'outline') {
      ctx.lineWidth = 1.1;
      ctx.stroke(path);
    } else {
      ctx.fill(path);
    }
  }
  ctx.restore();
}
