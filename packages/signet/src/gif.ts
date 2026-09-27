/// <reference path="./gifenc.d.ts" />
import * as gifencNs from 'gifenc';
import { getDesign, type SignetData, type SignetId } from './templates';
import { RENDERERS, type Ctx, type Frame } from './render';

// gifenc's ESM build exports its API as the namespace in Node but under `default` in some
// bundles: use whichever object actually has the functions.
type Gifenc = Pick<typeof gifencNs, 'GIFEncoder' | 'applyPalette' | 'quantize'>;
const gifenc = [gifencNs, (gifencNs as unknown as { default?: unknown }).default].find(
  (c) => c && typeof (c as Partial<Gifenc>).quantize === 'function',
) as Gifenc;

/** Every animated signature image must fit this (Gmail and Outlook both choke on huge GIFs). */
export const GIF_BUDGET_BYTES = 300 * 1024;
/** Fastest allowed frame rate (the project-wide 12 fps ceiling). */
export const MIN_FRAME_MS = 1000 / 12;

export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: '2d', opts?: { willReadFrequently?: boolean }): unknown;
}
/** Makes a canvas: `document.createElement('canvas')` in the browser, @napi-rs/canvas in Node. */
export type MakeCanvas = (width: number, height: number) => CanvasLike;

export interface RenderedGif {
  id: SignetId;
  bytes: Uint8Array;
  /** Display size in the email (CSS px). */
  width: number;
  height: number;
  /** Device pixels per CSS pixel actually encoded (2 = retina, lower if the budget forced it). */
  scale: number;
  /** Frames after merging identical neighbours. */
  frames: number;
  /** Total loop length, ms. */
  durationMs: number;
}

interface RawFrame {
  rgba: Uint8ClampedArray;
  delayMs: number;
}

function context(c: CanvasLike): Ctx {
  return c.getContext('2d', { willReadFrequently: true }) as Ctx;
}

/** Draw every frame of one design's animated slot at `scale`. */
export function renderFrames(
  id: SignetId,
  d: SignetData,
  accent: string,
  make: MakeCanvas,
  scale: number,
  frames?: Frame[],
): { width: number; height: number; frames: RawFrame[] } {
  const design = getDesign(id);
  const r = RENDERERS[id];
  const W = Math.round(design.w * scale);
  const H = Math.round(design.h * scale);
  const canvas = make(W, H);
  const ctx = context(canvas);
  const layerCanvas = make(W, H);
  const layerCtx = context(layerCanvas);
  const env = {
    scale,
    layer: () => {
      layerCtx.setTransform(1, 0, 0, 1, 0, 0);
      layerCtx.clearRect(0, 0, W, H);
      layerCtx.setTransform(scale, 0, 0, scale, 0, 0);
      return layerCtx;
    },
  };
  const out: RawFrame[] = [];
  for (const f of frames ?? r.frames(d)) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = r.background;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, design.w, design.h); // `.anim { overflow: hidden }`
    ctx.clip();
    r.draw(ctx, d, accent, f.t, env);
    ctx.restore();
    const data = ctx.getImageData(0, 0, W, H).data;
    out.push({ rgba: new Uint8ClampedArray(data), delayMs: f.delayMs });
  }
  return { width: W, height: H, frames: out };
}

function sameBytes(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Merge runs of identical frames into one longer frame. */
function dedupe(frames: RawFrame[]): RawFrame[] {
  const out: RawFrame[] = [];
  for (const f of frames) {
    const last = out[out.length - 1];
    if (last && sameBytes(last.rgba, f.rgba)) last.delayMs += f.delayMs;
    else out.push({ rgba: f.rgba, delayMs: f.delayMs });
  }
  // a loop whose last frame equals its first can fold into it too
  if (out.length > 1 && sameBytes(out[0]!.rgba, out[out.length - 1]!.rgba)) {
    out[0]!.delayMs += out.pop()!.delayMs;
  }
  return out;
}

/** Keep every other frame (each kept frame takes over its neighbour's time). */
function decimate(frames: RawFrame[]): RawFrame[] {
  const out: RawFrame[] = [];
  for (let i = 0; i < frames.length; i += 2) {
    const next = frames[i + 1];
    out.push({ rgba: frames[i]!.rgba, delayMs: frames[i]!.delayMs + (next ? next.delayMs : 0) });
  }
  return out;
}

/** gifenc only writes full frames at (0, 0), so it is used for LZW only: this pulls the
 * compressed image data (min code size + sub-blocks) out of a one-frame GIF it produced. */
function lzwBlock(
  index: Uint8Array,
  w: number,
  h: number,
  palette: number[][],
  colorDepth: number,
): Uint8Array {
  const g = gifenc.GIFEncoder();
  g.writeFrame(index, w, h, { palette, repeat: -1, colorDepth });
  g.finish();
  const b = g.bytes();
  let p = 13;
  if (b[10]! & 0x80) p += 3 * (1 << ((b[10]! & 7) + 1));
  while (b[p] !== 0x2c) {
    if (b[p] !== 0x21) throw new Error('unexpected GIF block');
    p += 2;
    while (b[p] !== 0) p += b[p]! + 1;
    p++;
  }
  p += 10; // image descriptor (no local colour table)
  const start = p++;
  while (b[p] !== 0) p += b[p]! + 1;
  return b.slice(start, p + 1);
}

class Bytes {
  private buf = new Uint8Array(1 << 16);
  length = 0;
  push(...v: number[]) {
    this.ensure(v.length);
    for (const x of v) this.buf[this.length++] = x & 0xff;
  }
  u16(v: number) {
    this.push(v & 0xff, (v >> 8) & 0xff);
  }
  append(b: Uint8Array) {
    this.ensure(b.length);
    this.buf.set(b, this.length);
    this.length += b.length;
  }
  private ensure(n: number) {
    if (this.length + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.length + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
  }
  bytes() {
    return this.buf.slice(0, this.length);
  }
}

/**
 * Encode a looping GIF with one palette for the whole loop. After the first frame, each frame
 * only covers the rectangle of pixels that changed, drawn over the previous frame (disposal
 * "keep"), and is stored either as that full rectangle or with unchanged pixels transparent —
 * whichever compresses smaller. Scrolling strips gain from the crop, mostly-still designs from
 * the transparency.
 */
export function encode(
  width: number,
  height: number,
  frames: RawFrame[],
  maxColors = 255,
): { bytes: Uint8Array; frames: number } {
  if (!frames.length) throw new Error('no frames');
  // palette from a sample of the frames (up to ~600k pixels)
  const px = width * height;
  const every = Math.max(1, Math.ceil((px * frames.length) / 600_000));
  const picked = frames.filter((_, i) => i % every === 0);
  const sample = new Uint8ClampedArray(picked.length * px * 4);
  picked.forEach((f, i) => sample.set(f.rgba, i * px * 4));
  const colors = gifenc.quantize(sample, maxColors);
  // one extra slot, never matched by applyPalette, marks "unchanged since the last frame"
  const transparentIndex = colors.length;
  const palette = [...colors, [0, 0, 0]];
  // the LZW code size follows the palette: a 64-colour loop compresses with 6-bit codes, not 8
  let depth = 2;
  while (1 << depth < palette.length) depth++;

  const out = new Bytes();
  for (const c of 'GIF89a') out.push(c.charCodeAt(0));
  out.u16(width);
  out.u16(height);
  out.push(0x80 | ((depth - 1) << 4) | (depth - 1), 0, 0);
  for (let i = 0; i < 1 << depth; i++) out.push(...(palette[i] ?? [0, 0, 0]));
  // NETSCAPE2.0: loop forever
  out.push(0x21, 0xff, 0x0b, ...[...'NETSCAPE2.0'].map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0);

  const minDelay = Math.ceil(MIN_FRAME_MS / 10); // centiseconds, still under 12 fps
  let prev: Uint8Array | null = null;
  // frames whose pixels ended up identical after palette mapping extend the previous frame
  const written: { gceAt: number; delay: number }[] = [];
  for (const f of frames) {
    const index = gifenc.applyPalette(f.rgba, colors);
    let x0 = 0;
    let y0 = 0;
    let x1 = width - 1;
    let y1 = height - 1;
    if (prev) {
      x0 = width;
      y0 = height;
      x1 = -1;
      y1 = -1;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          if (index[i] !== prev[i]) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      if (x1 < 0) {
        written[written.length - 1]!.delay += f.delayMs;
        continue;
      }
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const full = new Uint8Array(w * h);
    const holes = prev ? new Uint8Array(w * h) : null;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y + y0) * width + (x + x0);
        full[y * w + x] = index[i]!;
        if (holes) holes[y * w + x] = index[i] === prev![i] ? transparentIndex : index[i]!;
      }
    const a = lzwBlock(full, w, h, palette, depth);
    const b = holes ? lzwBlock(holes, w, h, palette, depth) : null;
    const useHoles = b !== null && b.length < a.length;
    written.push({ gceAt: out.length, delay: f.delayMs });
    out.push(
      0x21,
      0xf9,
      4,
      (1 << 2) | (useHoles ? 1 : 0),
      0,
      0,
      useHoles ? transparentIndex : 0,
      0,
    );
    out.push(0x2c);
    out.u16(x0);
    out.u16(y0);
    out.u16(w);
    out.u16(h);
    out.push(0);
    out.append(useHoles ? b! : a);
    prev = index;
  }
  out.push(0x3b);
  const bytes = out.bytes();
  for (const w of written) {
    const cs = Math.max(minDelay, Math.round(w.delay / 10));
    bytes[w.gceAt + 4] = cs & 0xff;
    bytes[w.gceAt + 5] = (cs >> 8) & 0xff;
  }
  return { bytes, frames: written.length };
}

/** Palette sizes tried, best first (plus one slot for transparency → 8, 7 and 6-bit codes). */
const COLOR_STEPS = [255, 127, 63];

/**
 * Render and encode one design's GIF at the best quality that fits the budget: 2x, then 1.5x,
 * then 1x, each with a full palette before smaller ones (flat designs lose nothing visible).
 * Dropping frames (which lowers the animation's frame rate) is the very last resort.
 */
export function renderGif(
  id: SignetId,
  d: SignetData,
  accent: string,
  make: MakeCanvas,
): RenderedGif {
  const design = getDesign(id);
  let best: RenderedGif | null = null;
  // Everything tried before a fit was over budget, so the first fit is also the smallest so far.
  const attempt = (scale: number, w: number, h: number, frames: RawFrame[], colors: number) => {
    const { bytes, frames: written } = encode(w, h, frames, colors);
    if (!best || bytes.length < best.bytes.length)
      best = {
        id,
        bytes,
        width: design.w,
        height: design.h,
        scale,
        frames: written,
        durationMs: frames.reduce((s, f) => s + f.delayMs, 0),
      };
    return bytes.length <= GIF_BUDGET_BYTES;
  };
  for (const scale of [2, 1.5, 1]) {
    const raw = renderFrames(id, d, accent, make, scale);
    const frames = dedupe(raw.frames);
    for (const colors of COLOR_STEPS)
      if (attempt(scale, raw.width, raw.height, frames, colors)) return best!;
    if (scale === 1) {
      let fewer = frames;
      for (let pass = 0; pass < 3 && fewer.length >= 4; pass++) {
        fewer = decimate(fewer);
        if (attempt(scale, raw.width, raw.height, fewer, COLOR_STEPS.at(-1)!)) return best!;
      }
    }
  }
  return best!;
}
