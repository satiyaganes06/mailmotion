import { describe, expect, it } from 'vitest';
import { normalizeStrokes, otsu, simplify, smooth, vectorizeSignature } from '../src';

type Pt = [number, number];

/** Rasterise thick polylines into an RGBA buffer (dark ink on white, or custom colours). */
function raster(
  w: number,
  h: number,
  lines: Pt[][],
  thickness: number,
  ink = [0, 0, 0, 255],
  bg = [255, 255, 255, 255],
) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set(bg, i * 4);
  const dist = (px: number, py: number, a: Pt, b: Pt) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1)),
    );
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (const l of lines)
        for (let i = 0; i < l.length - 1; i++)
          if (dist(x, y, l[i]!, l[i + 1]!) <= thickness / 2) d.set(ink, (y * w + x) * 4);
  return d;
}

const Z: Pt[] = [
  [20, 20],
  [180, 20],
  [20, 80],
  [180, 80],
]; // a "Z" stroke, 160 x 60

describe('polyline helpers', () => {
  it('simplify collapses collinear points and keeps corners', () => {
    expect(
      simplify(
        [
          [0, 0],
          [1, 0],
          [2, 0],
          [3, 0],
        ],
        0.1,
      ),
    ).toEqual([
      [0, 0],
      [3, 0],
    ]);
    expect(
      simplify(
        [
          [0, 0],
          [5, 0],
          [5, 5],
        ],
        0.1,
      ),
    ).toHaveLength(3);
  });
  it('smooth keeps the end points', () => {
    const s = smooth(
      [
        [0, 0],
        [5, 5],
        [10, 0],
      ],
      2,
    );
    expect(s[0]).toEqual([0, 0]);
    expect(s.at(-1)).toEqual([10, 0]);
    expect(s.length).toBeGreaterThan(3);
  });
  it('normalizeStrokes maps into 0..1 with the right aspect', () => {
    const m = normalizeStrokes([
      [
        [100, 50],
        [300, 50],
        [300, 100],
      ],
    ])!;
    expect(m.aspect).toBeCloseTo(200 / 50, 5);
    for (const s of m.strokes)
      for (const [x, y] of s) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
  });
  it('a single tap becomes a visible dot stroke; nothing yields null', () => {
    expect(normalizeStrokes([[[5, 5]]])!.strokes.length).toBe(1);
    expect(normalizeStrokes([])).toBeNull();
  });
  it('otsu splits a bimodal histogram', () => {
    const h = new Array(256).fill(0);
    h[30] = 500;
    h[220] = 500;
    const t = otsu(h);
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).toBeLessThan(220);
  });
});

describe('vectorizeSignature', () => {
  it('traces a thick "Z" into strokes that follow the original path', () => {
    const img = raster(200, 100, [Z], 7);
    const m = vectorizeSignature(img, 200, 100)!;
    expect(m).not.toBeNull();
    expect(m.strokes.length).toBeGreaterThanOrEqual(1);
    expect(m.aspect).toBeGreaterThan(2.3);
    expect(m.aspect).toBeLessThan(3.3);
    // total traced length is close to the polyline length (normalised to the 160x60 box)
    const len = m.strokes.reduce(
      (a, s) =>
        a +
        s
          .slice(1)
          .reduce((b, p, i) => b + Math.hypot((p[0] - s[i]![0]) * 160, (p[1] - s[i]![1]) * 60), 0),
      0,
    );
    const truth = 160 + Math.hypot(160, 60) + 160;
    expect(len).toBeGreaterThan(truth * 0.8);
    expect(len).toBeLessThan(truth * 1.25);
    // every point lies on/near one of the true segments
    const near = (x: number, y: number) => {
      const px = 20 + x * 160,
        py = 20 + y * 60;
      let best = Infinity;
      for (let i = 0; i < Z.length - 1; i++) {
        const a = Z[i]!,
          b = Z[i + 1]!;
        const dx = b[0] - a[0],
          dy = b[1] - a[1];
        const t = Math.max(
          0,
          Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)),
        );
        best = Math.min(best, Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy)));
      }
      return best;
    };
    for (const s of m.strokes) for (const [x, y] of s) expect(near(x, y)).toBeLessThan(6);
  });

  it('orders strokes left to right', () => {
    const img = raster(
      300,
      60,
      [
        [
          [20, 30],
          [60, 30],
        ],
        [
          [120, 30],
          [160, 30],
        ],
        [
          [230, 30],
          [270, 30],
        ],
      ],
      6,
    );
    const m = vectorizeSignature(img, 300, 60)!;
    expect(m.strokes).toHaveLength(3);
    const xs = m.strokes.map((s) => s[0]![0]);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it('handles light ink on a dark background', () => {
    const img = raster(200, 100, [Z], 7, [255, 255, 255, 255], [10, 10, 10, 255]);
    const m = vectorizeSignature(img, 200, 100)!;
    expect(m.aspect).toBeGreaterThan(2.3);
    expect(m.strokes.length).toBeGreaterThanOrEqual(1);
  });

  it('handles a transparent background (PNG signature)', () => {
    const img = raster(200, 100, [Z], 7, [20, 20, 120, 255], [0, 0, 0, 0]);
    const m = vectorizeSignature(img, 200, 100)!;
    expect(m.aspect).toBeGreaterThan(2.3);
  });

  it('returns null for a blank page', () => {
    expect(vectorizeSignature(raster(50, 50, [], 5), 50, 50)).toBeNull();
  });

  it('downsizes large scans but keeps proportions', () => {
    const img = raster(
      800,
      300,
      [
        [
          [40, 40],
          [720, 40],
          [40, 260],
        ],
      ],
      20,
    );
    const m = vectorizeSignature(img, 800, 300, { maxSize: 200 })!;
    expect(m.aspect).toBeGreaterThan(2.4);
    expect(m.aspect).toBeLessThan(3.1);
  });
});
