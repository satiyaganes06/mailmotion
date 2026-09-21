import { createCanvas, loadImage } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { serializeSignature } from '@mailmotion/serializer';
import {
  applyFilter,
  cropSquare,
  inspectGif,
  removeBackground,
  renderSignatureAssets,
  toSignatureAssets,
  uniqueFiles,
} from '../src';
import { surface } from '../src/env';
import { env, sample, testPhotoDataUrl } from './helpers';

const pngDataUrl = (draw: (ctx: any, w: number, h: number) => void, w = 120, h = 60) => {
  const c = createCanvas(w, h);
  draw(c.getContext('2d'), w, h);
  return `data:image/png;base64,${c.toBuffer('image/png').toString('base64')}`;
};
const px = (s: ReturnType<typeof surface>, x: number, y: number) =>
  Array.from(s.ctx.getImageData(x, y, 1, 1).data);

describe('photo preparation', () => {
  it('crops to a square, cover-fit, honouring zoom and pan', async () => {
    // left half red, right half blue
    const url = pngDataUrl((ctx, w, h) => {
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, w / 2, h);
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(w / 2, 0, w / 2, h);
    });
    const img = await env.loadImage(url);
    const flat = { x: 0, y: 0, zoom: 1, rotate: 0 };
    const centre = cropSquare(env, img, 60, flat);
    expect(px(centre, 5, 30)[0]).toBeGreaterThan(200); // left = red
    expect(px(centre, 55, 30)[2]).toBeGreaterThan(200); // right = blue
    // pan right (x = 1) reveals only the blue side
    const panned = cropSquare(env, img, 60, { ...flat, zoom: 2, x: 1 });
    expect(px(panned, 5, 30)[2]).toBeGreaterThan(200);
    // rotate 180: red/blue swap sides
    const flipped = cropSquare(env, img, 60, { ...flat, rotate: 180 });
    expect(px(flipped, 5, 30)[2]).toBeGreaterThan(200);
  });

  it('greyscale and duotone filters', async () => {
    const img = await env.loadImage(testPhotoDataUrl());
    const g = cropSquare(env, img, 40, { x: 0, y: 0, zoom: 1, rotate: 0 });
    applyFilter(g, 'greyscale', '#000000', '#ffffff');
    const p = px(g, 10, 10);
    expect(p[0]).toBe(p[1]);
    expect(p[1]).toBe(p[2]);
    const d = cropSquare(env, img, 40, { x: 0, y: 0, zoom: 1, rotate: 0 });
    applyFilter(d, 'duotone', '#100000', '#ffe0e0');
    const q = px(d, 10, 10);
    expect(q[0]).toBeGreaterThan(q[2]!); // red-tinted, not grey
  });
});

describe('removeBackground', () => {
  it('makes a plain border-connected background transparent and keeps the subject', () => {
    const s = surface(env, 80, 80);
    s.ctx.fillStyle = '#f4f4f4';
    s.ctx.fillRect(0, 0, 80, 80);
    s.ctx.fillStyle = '#cc2222';
    s.ctx.beginPath();
    s.ctx.arc(40, 40, 20, 0, Math.PI * 2);
    s.ctx.fill();
    // a light patch INSIDE the subject must survive (not connected to the border)
    s.ctx.fillStyle = '#f4f4f4';
    s.ctx.fillRect(36, 36, 8, 8);
    const r = removeBackground(s);
    expect(px(s, 2, 2)[3]).toBe(0);
    expect(px(s, 40, 40)[3]).toBe(255); // interior light patch kept
    expect(px(s, 40, 25)[3]).toBe(255); // subject kept
    expect(r.removedRatio).toBeGreaterThan(0);
  });
});

describe('extras: banner, logo, badges, divider, display name', () => {
  it('renders all four banner kinds', async () => {
    for (const kind of ['wave', 'ticker', 'shimmer', 'static'] as const) {
      const base = sample('wave');
      const image = pngDataUrl(
        (ctx, w, h) => {
          ctx.fillStyle = '#123456';
          ctx.fillRect(0, 0, w, h);
        },
        460,
        48,
      );
      const cfg = {
        ...base,
        extras: {
          ...base.extras,
          banner: {
            ...base.extras.banner,
            kind,
            text: 'Visit us at booth 12',
            image: kind === 'static' ? image : undefined,
          },
        },
      };
      const b = (await renderSignatureAssets(cfg, env)).find((a) => a.kind === 'banner')!;
      expect(b.format).toBe(kind === 'static' ? 'png' : 'gif');
      expect(b.width).toBe(460);
      if (b.format === 'gif') {
        const g = inspectGif(b.bytes);
        expect(g.frames).toBeGreaterThan(10);
        expect(g.maxFps).toBeLessThanOrEqual(12);
        expect(b.bytes.length).toBeLessThanOrEqual(300 * 1024);
      }
    }
  }, 120_000);

  it('renders logo (static + animated), badges, divider and baked display name', async () => {
    const logo = pngDataUrl(
      (ctx, w, h) => {
        ctx.fillStyle = '#0a7';
        ctx.fillRect(0, 0, w, h);
      },
      200,
      100,
    );
    const base = sample('aurora');
    const cfg = {
      ...base,
      typography: { ...base.typography, displayName: true },
      extras: {
        ...base.extras,
        divider: 'gradient' as const,
        logo: { enabled: true, image: logo, width: 80, animated: true },
        badges: [{ image: logo, alt: 'Cert' }],
      },
    };
    const assets = await renderSignatureAssets(cfg, env);
    const by = (k: string) => assets.find((a) => a.kind === k)!;
    expect(by('logo').format).toBe('gif');
    expect(by('logo').height).toBe(40); // 200x100 at width 80
    expect(inspectGif(by('logo').bytes).frames).toBeGreaterThan(10);
    expect(by('badge')).toMatchObject({ format: 'png', height: 36, width: 72 });
    expect(by('divider')).toMatchObject({ width: 400, height: 3 });
    expect(by('displayName').format).toBe('png');
    expect(by('displayName').width).toBeGreaterThan(40);
  }, 120_000);

  it('drops sections hidden by the reply variant', async () => {
    const base = sample('wave');
    const reply = await renderSignatureAssets(
      { ...base, layout: { ...base.layout, variant: 'reply' } },
      env,
    );
    expect(reply.some((a) => a.kind === 'banner')).toBe(false);
    expect(reply.some((a) => a.kind === 'mark')).toBe(false);
    expect(reply.some((a) => a.kind === 'avatar')).toBe(true);
  }, 120_000);
});

describe('social icons', () => {
  it('render in every style, in brand and single colour, and custom uploads', async () => {
    const seen = new Set<string>();
    const custom = pngDataUrl(
      (ctx, w, h) => {
        ctx.fillStyle = '#e11';
        ctx.fillRect(0, 0, w, h);
      },
      40,
      40,
    );
    for (const iconStyle of ['filled', 'outline', 'circle', 'square'] as const) {
      for (const iconColor of ['brand', 'single'] as const) {
        const base = sample('aurora');
        const cfg = {
          ...base,
          socials: {
            ...base.socials,
            iconStyle,
            iconColor,
            items: [
              ...base.socials.items.slice(0, 2),
              { platform: 'custom' as const, url: 'https://example.com/x', customIcon: custom },
            ],
          },
        };
        const icons = (await renderSignatureAssets(cfg, env)).filter((a) => a.kind === 'icon');
        expect(icons).toHaveLength(3);
        for (const i of icons) seen.add(i.hash);
        expect(icons[0]!.width).toBe(24);
      }
    }
    expect(seen.size).toBeGreaterThan(12);
  }, 120_000);

  it('produces 2x PNGs (48px for a 24px icon)', async () => {
    const icons = (await renderSignatureAssets(sample('aurora'), env)).filter(
      (a) => a.kind === 'icon',
    );
    const img = await loadImage(Buffer.from(icons[0]!.bytes));
    expect(img.width).toBe(48);
  });
});

describe('integration with the serializer', () => {
  it('renders, maps to hosted URLs and serializes lint-clean HTML for every design', async () => {
    for (const id of ['aurora', 'portrait', 'editorial', 'wave', 'neon', 'equalizer'] as const) {
      const cfg = sample(id);
      const rendered = await renderSignatureAssets(cfg, env);
      const assets = toSignatureAssets(rendered, 'https://cdn.example.com/sig');
      const { html, issues, chars } = serializeSignature(cfg, assets);
      expect(issues, id).toEqual([]);
      expect(chars).toBeLessThanOrEqual(10_000);
      for (const r of uniqueFiles(rendered).values())
        expect(html).toContain(`https://cdn.example.com/sig/${r.fileName}`);
    }
  }, 120_000);
});
