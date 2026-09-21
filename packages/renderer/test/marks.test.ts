import { describe, expect, it } from 'vitest';
import { normalizeStrokes, vectorizeSignature } from '@mailmotion/ink';
import { inspectGif, renderSignatureAssets } from '../src';
import { env, sample } from './helpers';

const alphaCount = (rgba: Uint8ClampedArray) => {
  let n = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i]! >= 128) n++;
  return n;
};

/** A hand-drawn-looking flourish in pixel space. */
function flourish(): [number, number][][] {
  const a: [number, number][] = [];
  for (let i = 0; i <= 60; i++) a.push([10 + i * 4, 60 + Math.sin(i / 6) * 30]);
  const b: [number, number][] = [
    [20, 100],
    [120, 95],
    [220, 100],
  ];
  return [a, b];
}

describe('drawn and uploaded marks', () => {
  it('a drawn mark animates and frame 1 is fully drawn', async () => {
    const drawn = normalizeStrokes(flourish())!;
    const base = sample('aurora');
    const cfg = {
      ...base,
      mark: {
        ...base.mark,
        mode: 'drawn' as const,
        strokes: drawn.strokes,
        strokesAspect: drawn.aspect,
      },
    };
    const a = (await renderSignatureAssets(cfg, env)).find((x) => x.kind === 'mark')!;
    expect(a.format).toBe('gif');
    const g = inspectGif(a.bytes);
    expect(g.frames).toBeGreaterThan(10);
    const full = alphaCount(g.frame(0));
    const mid = alphaCount(g.frame(Math.floor(g.frames / 2)));
    expect(full).toBeGreaterThan(200);
    expect(mid).toBeLessThan(full); // pen still drawing
    expect(a.width / a.height).toBeCloseTo(drawn.aspect, 0);
  }, 60_000);

  it('an uploaded (vectorized) mark renders, including fade and static variants', async () => {
    // "scan": dark thick "Z" on white
    const w = 240,
      h = 100;
    const img = new Uint8ClampedArray(w * h * 4).fill(255);
    const seg = (x0: number, y0: number, x1: number, y1: number) => {
      for (let t = 0; t <= 1; t += 0.002) {
        const cx = x0 + (x1 - x0) * t,
          cy = y0 + (y1 - y0) * t;
        for (let dy = -3; dy <= 3; dy++)
          for (let dx = -3; dx <= 3; dx++) {
            const o = (Math.round(cy + dy) * w + Math.round(cx + dx)) * 4;
            img[o] = img[o + 1] = img[o + 2] = 10;
          }
      }
    };
    seg(20, 20, 220, 20);
    seg(220, 20, 20, 80);
    seg(20, 80, 220, 80);
    const m = vectorizeSignature(img, w, h)!;
    const base = sample('aurora');
    for (const animation of ['ink', 'fade', 'none'] as const) {
      const cfg = {
        ...base,
        mark: {
          ...base.mark,
          mode: 'uploaded' as const,
          animation,
          strokes: m.strokes,
          strokesAspect: m.aspect,
        },
      };
      const a = (await renderSignatureAssets(cfg, env)).find((x) => x.kind === 'mark')!;
      expect(a.format).toBe(animation === 'none' ? 'png' : 'gif');
      if (a.format === 'gif') expect(alphaCount(inspectGif(a.bytes).frame(0))).toBeGreaterThan(300);
    }
  }, 120_000);
});
