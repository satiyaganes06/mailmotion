/** CSS `cubic-bezier(x1, y1, x2, y2)` as a function of progress 0..1 (Newton + bisection). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (p: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (p: number) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let t = p;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - p;
      if (Math.abs(err) < 1e-6) return sy(t);
      const d = dsx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = p;
    for (let i = 0; i < 40; i++) {
      const x = sx(t);
      if (Math.abs(x - p) < 1e-6) break;
      if (x < p) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

export const ease = cubicBezier(0.25, 0.1, 0.25, 1);
export const easeOut = cubicBezier(0, 0, 0.58, 1);
export const easeInOut = cubicBezier(0.42, 0, 0.58, 1);

/** Fractional part, always in [0, 1). */
export const frac = (v: number) => v - Math.floor(v);

/**
 * A CSS keyframe track: `stops` are [offset 0..1, value] pairs sorted by offset; the timing
 * function applies within each interval, as in CSS.
 */
export function keyframes(
  stops: [number, number][],
  timing: (p: number) => number,
): (p: number) => number {
  return (p: number) => {
    if (p <= stops[0]![0]) return stops[0]![1];
    for (let i = 1; i < stops.length; i++) {
      const [o1, v1] = stops[i]!;
      const [o0, v0] = stops[i - 1]!;
      if (p <= o1) return o1 === o0 ? v1 : v0 + (v1 - v0) * timing((p - o0) / (o1 - o0));
    }
    return stops[stops.length - 1]![1];
  };
}
