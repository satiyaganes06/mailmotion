import { normalizeStrokes, type DrawnMark } from './strokes';

type Pt = [number, number];

export interface VectorizeOptions {
  /** 0-255 luminance cut-off; default is Otsu's automatic threshold. */
  threshold?: number;
  /** Longest side to work at, in pixels (larger = slower, finer). */
  maxSize?: number;
  /** Drop spurs shorter than this many pixels. */
  minStroke?: number;
}

/** Otsu's method over a 256-bin histogram. */
export function otsu(hist: number[]): number {
  const total = hist.reduce((a, b) => a + b, 0);
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sumB = 0,
    wB = 0,
    best = 0,
    threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** Zhang–Suen thinning, in place. `img` is 1 = ink, 0 = background, with a 1px empty border. */
export function thin(img: Uint8Array, w: number, h: number): void {
  const at = (x: number, y: number) => img[y * w + x]!;
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      const remove: number[] = [];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (!at(x, y)) continue;
          const p2 = at(x, y - 1),
            p3 = at(x + 1, y - 1),
            p4 = at(x + 1, y),
            p5 = at(x + 1, y + 1);
          const p6 = at(x, y + 1),
            p7 = at(x - 1, y + 1),
            p8 = at(x - 1, y),
            p9 = at(x - 1, y - 1);
          const n = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (n < 2 || n > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let a = 0;
          for (let i = 0; i < 8; i++) if (seq[i] === 0 && seq[i + 1] === 1) a++;
          if (a !== 1) continue;
          if (pass === 0) {
            if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue;
          } else if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
          remove.push(y * w + x);
        }
      }
      if (remove.length) changed = true;
      for (const i of remove) img[i] = 0;
    }
  }
}

const N8: Pt[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

/** Walk a 1-pixel-wide skeleton into polylines (endpoints first, then loops). */
export function traceSkeleton(img: Uint8Array, w: number, h: number, minStroke: number): Pt[][] {
  const idx = (x: number, y: number) => y * w + x;
  const neighbours = (x: number, y: number): Pt[] => {
    const out: Pt[] = [];
    for (const [dx, dy] of N8) {
      const nx = x + dx,
        ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && img[idx(nx, ny)]) out.push([nx, ny]);
    }
    return out;
  };
  const visited = new Uint8Array(w * h);
  const strokes: Pt[][] = [];

  const walk = (sx: number, sy: number) => {
    const path: Pt[] = [[sx, sy]];
    visited[idx(sx, sy)] = 1;
    let [x, y] = [sx, sy];
    for (;;) {
      const next = neighbours(x, y).filter(([nx, ny]) => !visited[idx(nx, ny)]);
      if (!next.length) break;
      // prefer 4-connected steps, then continue straight
      next.sort(
        (a, b) =>
          Math.abs(a[0] - x) + Math.abs(a[1] - y) - (Math.abs(b[0] - x) + Math.abs(b[1] - y)),
      );
      const [nx, ny] = next[0]!;
      visited[idx(nx, ny)] = 1;
      path.push([nx, ny]);
      [x, y] = [nx, ny];
    }
    return path;
  };

  const starts: Pt[] = [];
  const loops: Pt[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!img[idx(x, y)]) continue;
      const deg = neighbours(x, y).length;
      if (deg <= 1) starts.push([x, y]);
      else loops.push([x, y]);
    }
  }
  // leftmost endpoints first: handwriting runs left to right
  starts.sort((a, b) => a[0] - b[0]);
  for (const [x, y] of starts) if (!visited[idx(x, y)]) strokes.push(walk(x, y));
  for (const [x, y] of loops) if (!visited[idx(x, y)]) strokes.push(walk(x, y));

  return strokes.filter((s) => s.length >= minStroke);
}

/**
 * Vectorise a scanned/photographed signature (RGBA) into pen strokes for the ink animation.
 * Handles dark ink on a light or transparent background (or the reverse). Returns null when no ink
 * is found.
 */
export function vectorizeSignature(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  opts: VectorizeOptions = {},
): DrawnMark | null {
  const maxSize = opts.maxSize ?? 260;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const w = Math.max(3, Math.round(width * scale)) + 2;
  const h = Math.max(3, Math.round(height * scale)) + 2;

  // luminance + alpha at working resolution (box-average)
  const lum = new Float32Array(w * h);
  const alpha = new Float32Array(w * h);
  const cnt = new Float32Array(w * h);
  for (let y = 0; y < height; y++) {
    const ty = Math.min(h - 3, Math.floor(y * scale)) + 1;
    for (let x = 0; x < width; x++) {
      const tx = Math.min(w - 3, Math.floor(x * scale)) + 1;
      const o = (y * width + x) * 4;
      const a = rgba[o + 3]! / 255;
      const i = ty * w + tx;
      lum[i]! +=
        (0.2126 * rgba[o]! + 0.7152 * rgba[o + 1]! + 0.0722 * rgba[o + 2]!) * a + 255 * (1 - a);
      alpha[i]! += a;
      cnt[i]! += 1;
    }
  }
  let transparent = 0,
    seen = 0;
  for (let i = 0; i < lum.length; i++) {
    if (!cnt[i]) continue;
    lum[i]! /= cnt[i]!;
    alpha[i]! /= cnt[i]!;
    seen++;
    if (alpha[i]! < 0.5) transparent++;
  }
  const hasTransparency = seen > 0 && transparent / seen > 0.2;

  const bin = new Uint8Array(w * h);
  if (hasTransparency) {
    for (let i = 0; i < bin.length; i++) bin[i] = cnt[i] && alpha[i]! >= 0.5 ? 1 : 0;
  } else {
    const hist = new Array<number>(256).fill(0);
    for (let i = 0; i < lum.length; i++) if (cnt[i]) hist[Math.min(255, Math.round(lum[i]!))]!++;
    const t = opts.threshold ?? otsu(hist);
    // ink is the minority class; if most pixels are dark the ink must be light
    let dark = 0,
      total = 0;
    for (let i = 0; i < lum.length; i++)
      if (cnt[i]) {
        total++;
        if (lum[i]! <= t) dark++;
      }
    const inkIsDark = dark <= total / 2;
    for (let i = 0; i < bin.length; i++)
      bin[i] = cnt[i] && (inkIsDark ? lum[i]! <= t : lum[i]! > t) ? 1 : 0;
  }

  // crop to the ink's bounding box (keeping a 1px empty border for thinning)
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++)
      if (bin[y * w + x]) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
  if (maxX < 0) return null;
  const cw = maxX - minX + 1 + 2;
  const ch = maxY - minY + 1 + 2;
  const img = new Uint8Array(cw * ch);
  for (let y = 0; y < ch - 2; y++)
    for (let x = 0; x < cw - 2; x++) img[(y + 1) * cw + x + 1] = bin[(y + minY) * w + x + minX]!;

  thin(img, cw, ch);
  const raw = traceSkeleton(img, cw, ch, opts.minStroke ?? 4);
  if (!raw.length) return null;
  return normalizeStrokes(raw, { epsilon: 0.006 });
}
