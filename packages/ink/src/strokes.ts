import type { Stroke } from '@mailmotion/schema';

type Pt = [number, number];

/** Ramer–Douglas–Peucker simplification. */
export function simplify(points: Pt[], epsilon: number): Pt[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = points[a]!;
    const [bx, by] = points[b]!;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-9;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i]!;
      const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > epsilon) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Chaikin corner cutting: rounds a polyline while keeping its end points. */
export function smooth(points: Pt[], iterations = 2): Pt[] {
  let pts = points;
  for (let it = 0; it < iterations && pts.length > 2; it++) {
    const out: Pt[] = [pts[0]!];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i]!;
      const [x1, y1] = pts[i + 1]!;
      out.push(
        [x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25],
        [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75],
      );
    }
    out.push(pts[pts.length - 1]!);
    pts = out;
  }
  return pts;
}

export interface DrawnMark {
  strokes: Stroke[];
  /** Width / height of the strokes' bounding box. */
  aspect: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Turn raw pointer strokes (in any pixel space) into a normalised mark: smoothed, simplified,
 * cropped to their bounding box, scaled to 0..1 and ordered as written.
 */
export function normalizeStrokes(
  raw: Pt[][],
  opts: { epsilon?: number; padding?: number } = {},
): DrawnMark | null {
  const strokes = raw.filter((s) => s.length >= 2);
  // a single tap becomes a short dot-stroke so it still shows
  for (const s of raw)
    if (s.length === 1) strokes.push([s[0]!, [s[0]![0] + 0.01, s[0]![1] + 0.01]]);
  if (!strokes.length) return null;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const s of strokes) {
    for (const [x, y] of s) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const w = Math.max(maxX - minX, 1e-6);
  const h = Math.max(maxY - minY, 1e-6);
  const pad = opts.padding ?? 0.02;
  const eps = (opts.epsilon ?? 0.004) * Math.max(w, h);

  const out: Stroke[] = strokes
    .map((s) => smooth(simplify(s as Pt[], eps), 2))
    .map((s) =>
      s.map(
        ([x, y]) =>
          [
            clamp01(pad + ((x - minX) / w) * (1 - 2 * pad)),
            clamp01(pad + ((y - minY) / h) * (1 - 2 * pad)),
          ] as Pt,
      ),
    )
    .filter((s) => s.length >= 2)
    .map((s) => (s.length > 2000 ? simplify(s, 0.01).slice(0, 2000) : s));
  return { strokes: out.slice(0, 200), aspect: w / h };
}
