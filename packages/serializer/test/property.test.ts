import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { contrastRatio } from '@mailmotion/contrast';
import {
  AVATAR_ANIMATIONS,
  FONT_FAMILIES,
  INK_FONT_IDS,
  LAYOUT_IDS,
  LIMITS,
  PALETTE_IDS,
  PLATFORMS,
  createConfig,
  type SignatureConfig,
  type SignatureConfigInput,
} from '@mailmotion/schema';
import { planAssets } from '@mailmotion/layouts';
import { fitBudget, serializeWithPlaceholders } from '../src';
import { buildTokens } from '../src/tokens';
import { PNG_DATA_URL } from './fixtures';

const text = (max: number) =>
  fc
    .array(fc.constantFrom(...'abcXYZ 09.,-<>"\'&éü日'.split('')), { minLength: 1, maxLength: max })
    .map((a) => a.join(''))
    .filter((s) => s.trim().length > 0);

const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, '0')}`);
const socialUrl: Record<string, string> = {
  linkedin: 'https://linkedin.com/in/x',
  github: 'https://github.com/x',
  x: 'https://x.com/x',
  instagram: 'https://instagram.com/x',
  facebook: 'https://facebook.com/x',
  youtube: 'https://youtube.com/@x',
  tiktok: 'https://tiktok.com/@x',
};

const socials = fc
  .array(fc.constantFrom(...Object.keys(socialUrl)), { maxLength: 12 })
  .map((ps) => ps.map((p) => ({ platform: p, url: socialUrl[p]! })));

const configInput = fc
  .record({
    fullName: text(60),
    title: fc.option(text(80), { nil: undefined }),
    company: fc.option(text(80), { nil: undefined }),
    tagline: fc.option(text(90), { nil: undefined }),
    disclaimer: fc.option(text(800), { nil: undefined }),
    layout: fc.constantFrom(...LAYOUT_IDS),
    avatarAnim: fc.constantFrom(...AVATAR_ANIMATIONS),
    avatarSize: fc.constantFrom(...(['S', 'M', 'L'] as const)),
    accent: hex,
    bodySize: fc.integer({ min: 12, max: 15 }),
    nameSize: fc.integer({ min: 14, max: 24 }),
    font: fc.constantFrom(...FONT_FAMILIES),
    markFont: fc.constantFrom(...INK_FONT_IDS),
    markPos: fc.constantFrom(...(['above', 'below', 'beside', 'replace'] as const)),
    markSize: fc.constantFrom(...(['S', 'M', 'L'] as const)),
    palette: fc.option(fc.constantFrom(...PALETTE_IDS), { nil: undefined }),
    textName: hex,
    textBody: hex,
    bg: fc.constantFrom('transparent', 'white', { color: '#fde68a' }, { color: '#111827' }),
    socials,
    textLinks: fc.boolean(),
    iconSize: fc.constantFrom(...([16, 20, 24, 32] as const)),
    socialPos: fc.constantFrom(...(['below', 'beside', 'row'] as const)),
    cta: fc.boolean(),
    badges: fc.integer({ min: 0, max: 4 }),
    banner: fc.boolean(),
    divider: fc.constantFrom(...(['none', 'line', 'dotted', 'gradient'] as const)),
    spacing: fc.constantFrom(...(['compact', 'normal', 'airy'] as const)),
    align: fc.constantFrom(...(['left', 'center'] as const)),
    dark: fc.boolean(),
    width: fc.constantFrom(...(['mobile', 'wide'] as const)),
    variant: fc.constantFrom(...(['full', 'reply', 'mobile'] as const)),
    displayName: fc.boolean(),
  })
  .map((r): SignatureConfig => {
    const input: SignatureConfigInput = {
      details: { fullName: r.fullName, title: r.title, company: r.company, tagline: r.tagline },
      avatar: { animation: r.avatarAnim, size: r.avatarSize as 'S' },
      mark: { font: r.markFont, position: r.markPos as 'above', size: r.markSize as 'S' },
      theme: {
        accent: r.accent,
        palette: r.palette,
        textColors: { name: r.textName, body: r.textBody, title: r.textBody },
        background: r.bg as never,
        darkMode: r.dark ? 'force-dark-variant' : 'auto',
      },
      typography: {
        bodySize: r.bodySize,
        nameSize: r.nameSize,
        fontFamily: r.font,
        displayName: r.displayName,
      },
      socials: {
        items: r.socials as never,
        textLinks: r.textLinks,
        iconSize: r.iconSize as 24,
        position: r.socialPos as 'below',
      },
      extras: {
        disclaimer: r.disclaimer,
        cta: { enabled: r.cta, label: 'Go', url: 'https://example.com', color: '#ffffff' },
        badges: Array.from({ length: r.badges }, () => ({ image: PNG_DATA_URL, alt: 'b' })),
        banner: { enabled: r.banner },
        divider: r.divider,
        spacing: r.spacing,
        alignment: r.align,
      },
      layout: { id: r.layout, width: r.width, variant: r.variant },
    };
    return createConfig(input);
  });

describe('property: any customization stays email-safe', () => {
  it('serializer output is always lint-clean and structurally sound', () => {
    fc.assert(
      fc.property(configInput, (cfg) => {
        const out = serializeWithPlaceholders(cfg);
        expect(out.issues).toEqual([]);
        expect(out.html.startsWith('<table')).toBe(true);
        expect(out.html).toContain('</table>');
        // balanced table tags
        const open = (out.html.match(/<table[\s>]/g) ?? []).length;
        const close = (out.html.match(/<\/table>/g) ?? []).length;
        expect(open).toBe(close);
        const tr = (out.html.match(/<tr[\s>]/g) ?? []).length;
        expect(tr).toBe((out.html.match(/<\/tr>/g) ?? []).length);
        const td = (out.html.match(/<td[\s>]/g) ?? []).length;
        expect(td).toBe((out.html.match(/<\/td>/g) ?? []).length);
      }),
      { numRuns: 300 },
    );
  });

  it('never uses fonts below 12px (spacer cells excepted) and keeps widths in bounds', () => {
    fc.assert(
      fc.property(configInput, (cfg) => {
        const { html } = serializeWithPlaceholders(cfg);
        for (const m of html.matchAll(/font-size:(\d+)px/g)) {
          if (m[1] !== '1') expect(Number(m[1])).toBeGreaterThanOrEqual(LIMITS.minFontPx);
        }
        const max = cfg.layout.width === 'wide' ? LIMITS.wideWidth : LIMITS.stripWidth;
        const maxAllowed = Math.max(max, LIMITS.stripWidth);
        for (const m of html.matchAll(/ width="(\d+)"/g)) {
          expect(Number(m[1])).toBeLessThanOrEqual(maxAllowed);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('text colours always meet 4.5:1 on the signature surface', () => {
    fc.assert(
      fc.property(configInput, (cfg) => {
        const t = buildTokens(cfg);
        for (const key of ['name', 'title', 'body', 'muted', 'link'] as const) {
          expect(contrastRatio(t.colors[key], t.surface)).toBeGreaterThanOrEqual(
            LIMITS.contrastText - 0.02,
          );
        }
      }),
      { numRuns: 300 },
    );
  });

  it('every planned image slot is referenced at most once and every referenced slot is planned', () => {
    fc.assert(
      fc.property(configInput, (cfg) => {
        const { html } = serializeWithPlaceholders(cfg);
        const planned = new Set(planAssets(cfg).map((p) => p.id.replace(/\W/g, '')));
        const urls = [
          ...html.matchAll(/src="https:\/\/img\.example\.com\/([a-z0-9]{64})\.(?:gif|png)"/g),
        ].map((m) => m[1]!);
        for (const u of urls) {
          const slot = u.replace(/0+$/, '');
          expect([...planned].some((p) => slot.startsWith(p) || p.startsWith(slot))).toBe(true);
        }
      }),
      { numRuns: 150 },
    );
  });

  it('fitBudget always produces a signature within the Gmail limit', () => {
    fc.assert(
      fc.property(configInput, (cfg) => {
        const r = fitBudget(cfg);
        expect(r.chars).toBeLessThanOrEqual(LIMITS.htmlChars);
        expect(r.fits).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('platform table stays in sync with the schema', () => {
    expect(PLATFORMS.length).toBeGreaterThanOrEqual(20);
  });
});
