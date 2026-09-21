import { hexToRgb, mix } from '@mailmotion/contrast';
import type { CanvasLike } from '@mailmotion/animations';
import type { SignatureConfig } from '@mailmotion/schema';
import { surface, type RenderEnv, type Surface } from './env';

type Crop = SignatureConfig['avatar']['crop'];

/**
 * Crop, zoom and rotate an image into a `size x size` canvas (cover-fit, like an avatar picker).
 * `x`/`y` in [-1, 1] pan across the available overflow; `zoom` >= 1.
 */
export function cropSquare(env: RenderEnv, image: CanvasLike, size: number, crop: Crop): Surface {
  const s = surface(env, size, size);
  const base = Math.max(size / image.width, size / image.height) * crop.zoom;
  const w = image.width * base;
  const h = image.height * base;
  const maxX = Math.max(0, (w - size) / 2);
  const maxY = Math.max(0, (h - size) / 2);
  s.ctx.save();
  s.ctx.translate(size / 2, size / 2);
  s.ctx.rotate((crop.rotate * Math.PI) / 180);
  s.ctx.imageSmoothingEnabled = true;
  s.ctx.imageSmoothingQuality = 'high';
  s.ctx.drawImage(
    image as unknown as CanvasImageSource,
    -w / 2 - crop.x * maxX,
    -h / 2 - crop.y * maxY,
    w,
    h,
  );
  s.ctx.restore();
  return s;
}

/** Fit a logo inside the box without cropping, leaving a little padding. */
export function containImage(
  env: RenderEnv,
  image: CanvasLike,
  size: number,
  padding = 0.1,
): Surface {
  const s = surface(env, size, size);
  const inner = size * (1 - padding * 2);
  const k = Math.min(inner / image.width, inner / image.height);
  const w = image.width * k;
  const h = image.height * k;
  s.ctx.imageSmoothingQuality = 'high';
  s.ctx.drawImage(image as unknown as CanvasImageSource, (size - w) / 2, (size - h) / 2, w, h);
  return s;
}

export type PhotoFilter = 'none' | 'greyscale' | 'duotone';

/** In-place greyscale / duotone (dark -> light mapped between two colours). */
export function applyFilter(surf: Surface, filter: PhotoFilter, dark: string, light: string): void {
  if (filter === 'none') return;
  const { width, height } = surf.canvas;
  const img = surf.ctx.getImageData(0, 0, width, height);
  const d = img.data;
  const [dr, dg, db] = hexToRgb(filter === 'duotone' ? dark : '#000000');
  const [lr, lg, lb] = hexToRgb(filter === 'duotone' ? light : '#ffffff');
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!) / 255;
    d[i] = dr + (lr - dr) * lum;
    d[i + 1] = dg + (lg - dg) * lum;
    d[i + 2] = db + (lb - db) * lum;
  }
  surf.ctx.putImageData(img, 0, 0);
}

/** Duotone colours derived from the accent pair. */
export function duotoneColors(accent: string, secondary: string): { dark: string; light: string } {
  return { dark: mix(accent, '#000000', 0.62), light: mix(secondary, '#ffffff', 0.55) };
}

/**
 * Remove a plain background from a photo or signature scan, in the browser (no upload, no ML model).
 * Samples the image border to estimate the background colour, then makes similar pixels
 * transparent with a soft edge. Works on studio/plain backgrounds; busy backgrounds need a real
 * matting model.
 */
export function removeBackground(
  surf: Surface,
  opts: { tolerance?: number; feather?: number } = {},
): { removedRatio: number } {
  const tol = opts.tolerance ?? 42;
  const feather = opts.feather ?? 22;
  const { width, height } = surf.canvas;
  const img = surf.ctx.getImageData(0, 0, width, height);
  const d = img.data;

  // Median of border pixels approximates the background colour.
  const rs: number[] = [],
    gs: number[] = [],
    bs: number[] = [];
  const take = (x: number, y: number) => {
    const o = (y * width + x) * 4;
    rs.push(d[o]!);
    gs.push(d[o + 1]!);
    bs.push(d[o + 2]!);
  };
  for (let x = 0; x < width; x++) {
    take(x, 0);
    take(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    take(0, y);
    take(width - 1, y);
  }
  const med = (a: number[]) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)]!;
  const bg = [med(rs), med(gs), med(bs)];

  // Flood-fill from the border so interior regions of similar colour (white shirt) survive.
  const dist = (o: number) => Math.hypot(d[o]! - bg[0]!, d[o + 1]! - bg[1]!, d[o + 2]! - bg[2]!);
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (seen[i]) return;
    if (dist(i * 4) > tol + feather) return;
    seen[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    const y = (i - x) / width;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  let removed = 0;
  for (let i = 0; i < seen.length; i++) {
    if (!seen[i]) continue;
    const dd = dist(i * 4);
    const a = dd <= tol ? 0 : Math.min(1, (dd - tol) / feather);
    d[i * 4 + 3] = Math.round(d[i * 4 + 3]! * a);
    if (a < 0.5) removed++;
  }
  surf.ctx.putImageData(img, 0, 0);
  return { removedRatio: removed / seen.length };
}
