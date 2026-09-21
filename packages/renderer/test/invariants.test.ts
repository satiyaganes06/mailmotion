import { createCanvas, loadImage } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { LIMITS } from '@mailmotion/schema';
import {
  QUALITY_LADDER,
  decimate,
  encodeGif,
  encodeWithBudget,
  inspectGif,
  renderSignatureAssets,
  type RenderedAsset,
} from '../src';
import { env, sample, testPhotoDataUrl } from './helpers';

/** Alpha mask (1 = opaque) of a decoded RGBA buffer. */
const mask = (rgba: Uint8ClampedArray) =>
  Array.from({ length: rgba.length / 4 }, (_, i) => (rgba[i * 4 + 3]! >= 128 ? 1 : 0));

async function decodePng(bytes: Uint8Array) {
  const img = await loadImage(Buffer.from(bytes));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return {
    width: img.width,
    height: img.height,
    data: ctx.getImageData(0, 0, img.width, img.height).data,
  };
}

const iou = (a: number[], b: number[]) => {
  let inter = 0,
    uni = 0;
  for (let i = 0; i < a.length; i++) {
    inter += a[i]! & b[i]!;
    uni += a[i]! | b[i]!;
  }
  return uni === 0 ? 1 : inter / uni;
};

const only = (assets: RenderedAsset[], id: string) => assets.find((a) => a.slotId === id)!;

describe('frame 1 is always the complete state', () => {
  it('ink marks: frame 1 equals the static (finished) mark', async () => {
    const animated = only(await renderSignatureAssets(sample('aurora'), env), 'mark');
    const staticCfg = sample('aurora');
    const still = only(
      await renderSignatureAssets(
        { ...staticCfg, mark: { ...staticCfg.mark, animation: 'none' } },
        env,
      ),
      'mark',
    );
    expect(animated.format).toBe('gif');
    expect(still.format).toBe('png');
    const g = inspectGif(animated.bytes);
    const png = await decodePng(still.bytes);
    expect(g.width).toBe(png.width);
    expect(iou(mask(g.frame(0)), mask(png.data))).toBeGreaterThan(0.96);
    // and mid-animation frames really are different (not complete)
    const mid = mask(g.frame(Math.floor(g.frames / 2)));
    expect(iou(mid, mask(png.data))).toBeLessThan(0.9);
  }, 60_000);

  it('the first frame carries the hold delay, later frames stay <= 12 fps', async () => {
    const cfg = sample('aurora');
    const a = only(
      await renderSignatureAssets({ ...cfg, mark: { ...cfg.mark, holdMs: 2000 } }, env),
      'mark',
    );
    const g = inspectGif(a.bytes);
    expect(g.delaysMs[0]).toBeGreaterThanOrEqual(2000);
    for (const d of g.delaysMs.slice(1)) expect(d).toBeGreaterThanOrEqual(90);
  }, 60_000);

  it.each(['aurora', 'strip-reveal', 'pulse', 'neon', 'orbit', 'equalizer'] as const)(
    'avatar %s (with a photo): frame 1 shows the whole photo, not blank or covered',
    async (anim) => {
      const photo = testPhotoDataUrl();
      const base = sample('aurora');
      const cfg = {
        ...base,
        avatar: {
          ...base.avatar,
          animation: anim,
          source: 'photo' as const,
          image: photo,
          shape: 'circle' as const,
        },
      };
      const a = only(await renderSignatureAssets(cfg, env), 'avatar');
      const g = inspectGif(a.bytes);
      const f0 = mask(g.frame(0));
      const opaque = (m: number[]) => m.reduce((x, y) => x + y, 0);
      // frame 0 has at least as much opaque area as any other frame (nothing hidden/erased)
      const maxOther = Math.max(
        ...Array.from({ length: g.frames }, (_, i) => opaque(mask(g.frame(i)))),
      );
      if (anim !== 'pulse') expect(opaque(f0)).toBeGreaterThanOrEqual(maxOther * 0.97);
      // photo centre pixel is a photo colour: the neon/dark body or a cover strip would differ
      const c = ((g.height / 2) * g.width + g.width / 2) * 4;
      const px = g.frame(0);
      expect(px[c + 3]).toBeGreaterThan(128);
      if (anim === 'strip-reveal') {
        // photo, not the accent cover colour: cover would match the frame at t=0.7 instead
        const covered = g.frame(Math.round(g.frames * 0.7));
        const diff =
          Math.abs(px[c]! - covered[c]!) +
          Math.abs(px[c + 1]! - covered[c + 1]!) +
          Math.abs(px[c + 2]! - covered[c + 2]!);
        expect(diff).toBeGreaterThan(30);
      }
    },
    60_000,
  );

  it('aurora frame 1 has a complete ring (8 sampled angles)', async () => {
    const a = only(await renderSignatureAssets(sample('aurora'), env), 'avatar');
    const g = inspectGif(a.bytes);
    const f = g.frame(0);
    const r = g.width / 2 - g.width * 0.035;
    for (let k = 0; k < 8; k++) {
      const th = (k / 8) * Math.PI * 2;
      const x = Math.round(g.width / 2 + Math.cos(th) * r);
      const y = Math.round(g.height / 2 + Math.sin(th) * r);
      expect(f[(y * g.width + x) * 4 + 3], `angle ${k}`).toBeGreaterThan(128);
    }
  }, 60_000);

  it('finite loops (3x) stop on the complete frame', async () => {
    const cfg = sample('aurora');
    const three = { ...cfg, mark: { ...cfg.mark, loop: 'three' as const } };
    const a = only(await renderSignatureAssets(three, env), 'mark');
    const g = inspectGif(a.bytes);
    expect(g.loopCount).toBe(2);
    const still = only(
      await renderSignatureAssets({ ...cfg, mark: { ...cfg.mark, animation: 'none' } }, env),
      'mark',
    );
    const png = await decodePng(still.bytes);
    expect(iou(mask(g.frame(g.frames - 1)), mask(png.data))).toBeGreaterThan(0.96);
    expect(g.delaysMs.at(-1)).toBeGreaterThanOrEqual(2000);
  }, 60_000);
});

describe('GIF encoding', () => {
  const noise = (w: number, h: number, seed: number) => {
    const d = new Uint8ClampedArray(w * h * 4);
    let s = seed;
    for (let i = 0; i < d.length; i += 4) {
      s = (s * 1664525 + 1013904223) >>> 0;
      d[i] = s >>> 24;
      d[i + 1] = (s >>> 16) & 255;
      d[i + 2] = (s >>> 8) & 255;
      d[i + 3] = 255;
    }
    return d;
  };

  it('preserves transparency and disposal', () => {
    const w = 8,
      h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < 32; i++) {
      data[i * 4] = 255;
      data[i * 4 + 3] = 255;
    } // top half red, bottom half transparent
    const bytes = encodeGif(
      [
        { data, delayMs: 100 },
        { data, delayMs: 100 },
      ],
      { width: w, height: h, maxColors: 16, loopCount: 0 },
    );
    const g = inspectGif(bytes);
    const f = g.frame(0);
    expect(f[3]).toBe(255);
    expect(f[(7 * w + 0) * 4 + 3]).toBe(0);
  });

  it('degrades quality to fit a tiny byte budget and reports how', { timeout: 60_000 }, () => {
    const frames = Array.from({ length: 8 }, (_, i) => ({
      data: noise(40, 40, i + 1),
      delayMs: 100,
    }));
    const r = encodeWithBudget(
      () => frames,
      () => ({ width: 40, height: 40 }),
      0,
      4_000,
    );
    expect(r.degraded.length).toBeGreaterThan(0);
    expect(r.attempt.maxColors).toBeLessThan(256);
    const full = encodeGif(frames, { width: 40, height: 40, maxColors: 256, loopCount: 0 });
    expect(r.bytes.length).toBeLessThan(full.length);
  });

  it('decimate keeps frame 0 and total duration', () => {
    const fr = Array.from({ length: 10 }, (_, i) => ({ id: i, delayMs: 100 }));
    const d = decimate(fr, 3);
    expect(d[0]!.id).toBe(0);
    expect(d.reduce((a, f) => a + f.delayMs, 0)).toBe(1000);
  });

  it('the quality ladder is ordered best to smallest', () => {
    expect(QUALITY_LADDER[0]!.scale).toBe(2);
    expect(QUALITY_LADDER[0]!.maxColors).toBe(256);
    expect(QUALITY_LADDER.at(-1)!.maxColors).toBeLessThanOrEqual(32);
  });

  it('a photo-heavy 96px avatar still fits 300 KB', async () => {
    const base = sample('aurora');
    const cfg = {
      ...base,
      avatar: {
        ...base.avatar,
        source: 'photo' as const,
        image: testPhotoDataUrl(400),
        size: 'L' as const,
        animation: 'orbit' as const,
      },
    };
    const a = only(await renderSignatureAssets(cfg, env), 'avatar');
    expect(a.bytes.length).toBeLessThanOrEqual(LIMITS.gifBytes);
    expect(a.fitsBudget).toBe(true);
    // eslint-disable-next-line no-console
    console.log(
      `photo orbit avatar: ${a.bytes.length} bytes, ${a.frames} frames, scale ${a.scale}, degraded: ${a.degraded.join(', ') || 'none'}`,
    );
  }, 60_000);
});
