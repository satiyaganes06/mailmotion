/// <reference path="./gifenc.d.ts" />
import * as gifencNs from 'gifenc';
import { LIMITS } from '@mailmotion/schema';

// gifenc ships CJS (`main`) and ESM (`module`). In plain Node ESM only the CJS build is available and
// its API is the `default` export; in bundlers the namespace itself has the named exports (and its
// `default` is just the GIFEncoder function). Pick whichever object actually carries the API.
type Gifenc = Pick<typeof gifencNs, 'GIFEncoder' | 'applyPalette' | 'quantize'>;
const candidates = [gifencNs, (gifencNs as unknown as { default?: unknown }).default] as (
  Partial<Gifenc> | undefined
)[];
const gifenc = candidates.find((c) => c && typeof c.quantize === 'function') as Gifenc;
const { GIFEncoder, applyPalette, quantize } = gifenc;

export interface RawFrame {
  /** RGBA, straight (non-premultiplied) alpha. */
  data: Uint8ClampedArray;
  delayMs: number;
}

export interface EncodeOptions {
  width: number;
  height: number;
  /** Total palette size including the transparent entry (max 256). */
  maxColors: number;
  /** 0 = loop forever; n = play n more times (see `inkTimeline`). */
  loopCount: number;
}

/**
 * Encode frames into a GIF with one global palette and 1-bit transparency.
 * Frames use dispose-to-background so transparent regions never accumulate.
 */
export function encodeGif(frames: RawFrame[], o: EncodeOptions): Uint8Array {
  const { width, height } = o;
  const colors = Math.max(2, Math.min(255, o.maxColors - 1));

  // Palette from a sample of opaque pixels across all frames.
  const budgetPixels = 240_000;
  const perFrame = Math.max(1, Math.floor(budgetPixels / frames.length));
  const sample: number[] = [];
  for (const f of frames) {
    const n = f.data.length / 4;
    const step = Math.max(1, Math.floor(n / perFrame));
    for (let i = 0; i < n; i += step) {
      const o4 = i * 4;
      if (f.data[o4 + 3]! >= 128) sample.push(f.data[o4]!, f.data[o4 + 1]!, f.data[o4 + 2]!, 255);
    }
  }
  const palette: number[][] =
    sample.length > 0
      ? quantize(new Uint8Array(sample), colors, { format: 'rgb565' })
      : [[0, 0, 0]];
  const transparentIndex = palette.length;
  const fullPalette = [...palette, [0, 0, 0]];

  const gif = GIFEncoder();
  frames.forEach((f, i) => {
    const index = applyPalette(f.data, palette, 'rgb565') as Uint8Array;
    const px = f.data;
    for (let p = 0; p < index.length; p++) if (px[p * 4 + 3]! < 128) index[p] = transparentIndex;
    gif.writeFrame(index, width, height, {
      palette: i === 0 ? fullPalette : undefined,
      transparent: true,
      transparentIndex,
      delay: f.delayMs,
      dispose: 2,
      repeat: i === 0 ? (o.loopCount === 0 ? 0 : o.loopCount) : undefined,
    });
  });
  gif.finish();
  return gif.bytes();
}

export interface Attempt {
  scale: number;
  frameStep: number;
  maxColors: number;
}

/** From best quality to smallest. The first that fits the byte budget wins. */
export const QUALITY_LADDER: Attempt[] = [
  { scale: 2, frameStep: 1, maxColors: 256 },
  { scale: 2, frameStep: 1, maxColors: 128 },
  { scale: 2, frameStep: 1, maxColors: 64 },
  { scale: 2, frameStep: 2, maxColors: 128 },
  { scale: 2, frameStep: 2, maxColors: 64 },
  { scale: 1.5, frameStep: 2, maxColors: 64 },
  { scale: 1, frameStep: 2, maxColors: 64 },
  { scale: 1, frameStep: 3, maxColors: 32 },
];

export interface BudgetResult {
  bytes: Uint8Array;
  attempt: Attempt;
  fits: boolean;
  /** Human-readable description of what was reduced (empty if full quality fit). */
  degraded: string[];
  frameCount: number;
}

/** Keep every `step`-th frame (always frame 0), summing skipped delays into the kept frame. */
export function decimate<T extends { delayMs: number }>(frames: T[], step: number): T[] {
  if (step <= 1 || frames.length <= 2) return frames;
  const out: T[] = [];
  for (let i = 0; i < frames.length; i += step) {
    const delay = frames.slice(i, i + step).reduce((a, f) => a + f.delayMs, 0);
    out.push({ ...frames[i]!, delayMs: delay });
  }
  return out;
}

/**
 * Encode with automatic quality reduction until the GIF is within `LIMITS.gifBytes`.
 * `renderFrames(scale)` must draw the full frame list at that render scale.
 */
export function encodeWithBudget(
  renderFrames: (scale: number) => RawFrame[],
  dims: (scale: number) => { width: number; height: number },
  loopCount: number,
  maxBytes: number = LIMITS.gifBytes,
): BudgetResult {
  let best: BudgetResult | null = null;
  let lastScale = -1;
  let cached: RawFrame[] = [];
  for (const attempt of QUALITY_LADDER) {
    if (attempt.scale !== lastScale) {
      cached = renderFrames(attempt.scale);
      lastScale = attempt.scale;
    }
    const frames = decimate(cached, attempt.frameStep);
    const { width, height } = dims(attempt.scale);
    const bytes = encodeGif(frames, { width, height, maxColors: attempt.maxColors, loopCount });
    const degraded: string[] = [];
    if (attempt.maxColors < 256) degraded.push(`${attempt.maxColors} colours`);
    if (attempt.frameStep > 1)
      degraded.push(`every ${attempt.frameStep}${ordinal(attempt.frameStep)} frame`);
    if (attempt.scale < 2) degraded.push(`${attempt.scale}x resolution`);
    const res: BudgetResult = {
      bytes,
      attempt,
      fits: bytes.length <= maxBytes,
      degraded,
      frameCount: frames.length,
    };
    if (res.fits) return res;
    if (!best || bytes.length < best.bytes.length) best = res;
  }
  return best!;
}

function ordinal(n: number): string {
  return n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
}
