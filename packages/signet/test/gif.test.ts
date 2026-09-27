import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DESIGNS,
  GIF_BUDGET_BYTES,
  RENDERERS,
  renderFrames,
  renderGif,
  type MakeCanvas,
  type SignetData,
} from '../src';

GlobalFonts.registerFromPath(
  fileURLToPath(new URL('../../../apps/web/public/fonts/Caveat.ttf', import.meta.url)),
  'Caveat',
);

const make: MakeCanvas = (w, h) => createCanvas(w, h) as never;

const D: SignetData = {
  name: 'Aina Rahman',
  title: 'Product Designer',
  company: 'Lumen Labs',
  phone: '+60 12 345 6789',
  email: 'aina@lumenlabs.io',
  website: 'lumenlabs.io',
  tagline: 'Designing calmer fintech apps',
  status: 'Available for calls this week',
};
const A = '#2A5DB0';

/** Width, height, frame count and per-frame delays of a GIF (no pixel decoding). */
function inspect(bytes: Uint8Array) {
  const u = bytes;
  expect(String.fromCharCode(...u.slice(0, 6))).toBe('GIF89a');
  const width = u[6]! | (u[7]! << 8);
  const height = u[8]! | (u[9]! << 8);
  let p = 13;
  if (u[10]! & 0x80) p += 3 * (1 << ((u[10]! & 7) + 1));
  const delays: number[] = [];
  let pending = 0;
  let loops = false;
  while (p < u.length) {
    const b = u[p++]!;
    if (b === 0x3b) break;
    if (b === 0x21) {
      const label = u[p++]!;
      if (label === 0xf9) pending = (u[p + 2]! | (u[p + 3]! << 8)) * 10;
      if (label === 0xff) loops = true;
      while (u[p]! !== 0) p += u[p]! + 1;
      p++;
    } else if (b === 0x2c) {
      const packed = u[p + 8]!;
      p += 9;
      if (packed & 0x80) p += 3 * (1 << ((packed & 7) + 1));
      p++; // LZW min code size
      while (u[p]! !== 0) p += u[p]! + 1;
      p++;
      delays.push(pending);
    } else throw new Error(`bad block ${b} at ${p}`);
  }
  return { width, height, delays, loops };
}

describe('Simple Style GIFs', () => {
  for (const design of DESIGNS) {
    it(`${design.id}: renders a looping GIF within budget, at most 12 fps`, () => {
      const gif = renderGif(design.id, D, A, make);
      expect(gif.bytes.length).toBeLessThanOrEqual(GIF_BUDGET_BYTES);
      const info = inspect(gif.bytes);
      expect(info.loops).toBe(true);
      expect(info.width).toBe(Math.round(design.w * gif.scale));
      expect(info.height).toBe(Math.round(design.h * gif.scale));
      expect(info.delays.length).toBe(gif.frames);
      for (const ms of info.delays) expect(ms).toBeGreaterThanOrEqual(90);
      // the loop length is preserved through frame merging
      const expected = RENDERERS[design.id].frames(D).reduce((s, f) => s + f.delayMs, 0);
      expect(Math.abs(info.delays.reduce((s, x) => s + x, 0) - expected)).toBeLessThanOrEqual(
        info.delays.length * 10,
      );
      // report what quality each design got
      console.info(
        `${design.id.padEnd(10)} ${String(gif.scale).padEnd(4)}x ${String(gif.frames).padStart(3)} frames ${(gif.bytes.length / 1024).toFixed(1).padStart(6)} KB`,
      );
    }, 60_000);
  }

  it('shows the finished state on frame 1 (all classic Outlook ever shows)', () => {
    const ink = (s: 'first' | 'mid') => {
      const frames = RENDERERS.ink.frames(D);
      const f = s === 'first' ? frames[0]! : { t: 0, delayMs: 100 }; // t=0: nothing drawn yet
      const {
        frames: [raw],
      } = renderFrames('ink', D, A, make, 1, [f]);
      let inked = 0;
      for (let i = 0; i < raw!.rgba.length; i += 4) if (raw!.rgba[i + 2]! < 200) inked++;
      return inked;
    };
    expect(ink('first')).toBeGreaterThan(400);
    expect(ink('mid')).toBe(0);

    // text is #16213a (blue 58), the cursor is the accent (blue 176): count text ink only
    const typed = (t: number) => {
      const {
        frames: [raw],
      } = renderFrames('typewriter', D, A, make, 1, [{ t, delayMs: 100 }]);
      let inked = 0;
      for (let i = 0; i < raw!.rgba.length; i += 4) if (raw!.rgba[i + 2]! < 150) inked++;
      return inked;
    };
    const first = RENDERERS.typewriter.frames(D)[0]!.t;
    expect(typed(first)).toBeGreaterThan(typed(0.3) * 5);
  });
});

describe('the hand-written GIF container decodes to exactly what was drawn', () => {
  for (const design of DESIGNS) {
    it(`${design.id}: every frame, at every moment, matches the rendered frame`, async () => {
      const { GifReader } = await import('omggif');
      const gif = renderGif(design.id, D, A, make);
      const reader = new GifReader(gif.bytes as unknown as Buffer);
      const raw = renderFrames(design.id, D, A, make, gif.scale);
      expect([reader.width, reader.height]).toEqual([raw.width, raw.height]);
      expect(reader.loopCount()).toBe(0);

      // decode with disposal "keep": each frame is blitted over the previous picture
      const canvas = new Uint8Array(reader.width * reader.height * 4);
      const decoded: { start: number; rgba: Uint8Array }[] = [];
      let t = 0;
      for (let i = 0; i < reader.numFrames(); i++) {
        reader.decodeAndBlitFrameRGBA(i, canvas);
        decoded.push({ start: t, rgba: canvas.slice() });
        t += reader.frameInfo(i).delay * 10;
      }
      // A loop that ends on its first picture has that tail folded into frame 1, which rotates the
      // loop in time (same animation, looped forever): account for it when lining frames up.
      const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => a.every((v, i) => v === b[i]);
      let fold = 0;
      for (
        let i = raw.frames.length - 1;
        i > 0 && same(raw.frames[i]!.rgba, raw.frames[0]!.rgba);
        i--
      )
        fold += raw.frames[i]!.delayMs;
      // every drawn frame must be what the GIF shows at that moment of the loop
      let at = 0;
      let worst = 0;
      for (const f of raw.frames) {
        const when = (at + f.delayMs / 2 + fold) % t; // mid-frame: GIF rounds delays to 10ms
        const shown = [...decoded].reverse().find((x) => x.start <= when + 1)!;
        let sum = 0;
        for (let p = 0; p < f.rgba.length; p += 4)
          for (let c = 0; c < 3; c++) sum += Math.abs(f.rgba[p + c]! - shown.rgba[p + c]!);
        worst = Math.max(worst, sum / ((f.rgba.length / 4) * 3));
        at += f.delayMs;
      }
      // only palette quantisation error remains (mean per channel, 0–255)
      expect(worst).toBeLessThan(3);
    }, 60_000);
  }
});
