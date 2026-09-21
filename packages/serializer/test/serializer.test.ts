import { describe, expect, it } from 'vitest';
import { PRESET_IDS, LAYOUT_IDS, createConfig, type SignatureConfig } from '@mailmotion/schema';
import { placeholderAssets } from '@mailmotion/layouts';
import { lintHtml, serializeSignature, serializeWithPlaceholders } from '../src';
import { PNG_DATA_URL, SAMPLE_DETAILS, sampleFor } from './fixtures';

describe('serializer output for the six designs', () => {
  it.each(PRESET_IDS)('%s: lint-clean, within budget, snapshot', (id) => {
    const cfg = sampleFor(id);
    const out = serializeWithPlaceholders(
      cfg,
      'https://satiyaganes06.github.io/mailmotion-signatures',
    );
    expect(out.issues).toEqual([]);
    expect(out.chars).toBeLessThanOrEqual(10_000);
    expect(out.html).not.toMatch(/\n/);
    expect(out.html).not.toContain('<style');
    expect(out.html).not.toContain('<script');
    expect(out.html).toContain('Shatthiya Ganes');
    expect(out.html).toContain('mailto:ganes@vigilantasia.com');
    expect(out.html).toContain('tel:+60123456789');
    expect(out.html).toMatchSnapshot();
  });

  it('every image has explicit width/height/alt and https src', () => {
    for (const id of PRESET_IDS) {
      const { html } = serializeWithPlaceholders(sampleFor(id));
      const imgs = [...html.matchAll(/<img [^>]*>/g)].map((m) => m[0]);
      expect(imgs.length).toBeGreaterThan(0);
      for (const tag of imgs) {
        expect(tag).toMatch(/ width="\d+"/);
        expect(tag).toMatch(/ height="\d+"/);
        expect(tag).toMatch(/ alt="/);
        expect(tag).toMatch(/ src="https:\/\//);
      }
    }
  });

  it('never emits font sizes below 12px', () => {
    for (const id of PRESET_IDS) {
      const { html } = serializeWithPlaceholders(sampleFor(id));
      for (const m of html.matchAll(/font-size:(\d+)px/g)) {
        // 1px spacer cells (font-size:1px on empty rows) are exempt
        if (m[1] === '1') continue;
        expect(Number(m[1])).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it('keeps social tap targets at least 32px high', () => {
    const { html } = serializeWithPlaceholders(sampleFor('aurora'));
    const cells = [...html.matchAll(/<td valign="middle" height="(\d+)"/g)].map((m) =>
      Number(m[1]),
    );
    expect(cells.length).toBeGreaterThanOrEqual(7);
    for (const h of cells) expect(h).toBeGreaterThanOrEqual(32);
  });

  it('strips render sized for 460px and scale down', () => {
    const { html } = serializeWithPlaceholders(sampleFor('wave'));
    expect(html).toMatch(/width="460"[^>]*style="[^"]*width:100%;max-width:460px;height:auto/);
  });
});

describe('layouts', () => {
  it.each(LAYOUT_IDS)('%s renders with the sample details', (layoutId) => {
    const cfg = createConfig({ ...sampleFor('aurora'), layout: { id: layoutId } } as never);
    const out = serializeWithPlaceholders(cfg);
    expect(out.issues).toEqual([]);
    expect(out.html.startsWith('<table')).toBe(true);
    expect(out.html.endsWith('</table>')).toBe(true);
  });

  it('centres content in the stacked layout', () => {
    const cfg = sampleFor('equalizer');
    const { html } = serializeWithPlaceholders(cfg);
    expect(html).toContain('align="center"');
  });

  it('places the mark according to its position', () => {
    const base = sampleFor('aurora');
    const at = (position: 'above' | 'below' | 'beside' | 'replace') => {
      const c = createConfig({ ...base, mark: { ...base.mark, position } } as never);
      return serializeWithPlaceholders(c).html;
    };
    const mark = /mark0+[a-z0-9]*\.gif/;
    const idxName = (h: string) => h.indexOf('Shatthiya Ganes');
    const idxMark = (h: string) => h.search(mark);
    expect(idxMark(at('above'))).toBeLessThan(idxName(at('above')));
    expect(idxMark(at('below'))).toBeGreaterThan(idxName(at('below')));
    // "replace" swaps the name text for the mark image, the name survives in alt text only
    const replaced = at('replace');
    expect(replaced).not.toMatch(/>Shatthiya Ganes(<| )/);
    expect(replaced).toContain('alt="Shatthiya Ganes signature"');
  });

  it('honours field order and visibility', () => {
    const base = sampleFor('aurora');
    const c = createConfig({
      ...base,
      details: {
        ...base.details,
        hidden: ['email'],
        fieldOrder: [
          'company',
          'title',
          'phones',
          'email',
          'websites',
          'address',
          'tagline',
          'custom',
          'department',
        ],
      },
    } as never);
    const { html } = serializeWithPlaceholders(c);
    expect(html).not.toContain('mailto:');
    expect(html.indexOf('Vigilant Asia')).toBeLessThan(html.indexOf('Mobile Security Engineer'));
  });

  it('applies the reply variant (no banner, no mark)', () => {
    const wave = sampleFor('wave');
    const full = serializeWithPlaceholders(wave).html;
    const reply = serializeWithPlaceholders(
      createConfig({ ...wave, layout: { ...wave.layout, variant: 'reply' } } as never),
    ).html;
    expect(full).toMatch(/banner0+/);
    expect(reply).not.toMatch(/banner0+/);
    expect(reply.length).toBeLessThan(full.length);
  });
});

describe('extras', () => {
  const withExtras = () => {
    const base = sampleFor('aurora');
    return createConfig({
      ...base,
      extras: {
        ...base.extras,
        cta: { enabled: true, label: 'Book a call', url: 'https://cal.com/ada', color: '#ffffff' },
        badges: [{ image: PNG_DATA_URL, alt: 'ISO 27001', url: 'https://iso.org' }],
        disclaimer: 'This email is confidential.\nIf you received it in error, please delete it.',
        greenNote: true,
        divider: 'line',
        madeWith: true,
        logo: { enabled: true, image: PNG_DATA_URL, width: 80, animated: false },
      },
    } as never);
  };

  it('renders a table-based CTA button with a contrast-safe label', () => {
    const { html, issues } = serializeWithPlaceholders(withExtras());
    expect(issues).toEqual([]);
    expect(html).toMatch(
      /<td bgcolor="#[0-9a-f]{6}" style="background-color:#[0-9a-f]{6};[^"]*"><a href="https:\/\/cal\.com\/ada"/,
    );
    expect(html).toContain('Book a call');
  });

  it('renders disclaimer with line breaks, green note, divider and badge', () => {
    const { html } = serializeWithPlaceholders(withExtras());
    expect(html).toContain('This email is confidential.<br />If you received it in error');
    expect(html).toContain('Please consider the environment');
    expect(html).toContain('border-top:1px solid');
    expect(html).toContain('alt="ISO 27001"');
    expect(html).toContain('Made with MailMotion');
  });

  it('picks a readable CTA label colour when the chosen one would fail', () => {
    const c = createConfig({
      ...withExtras(),
      extras: {
        ...withExtras().extras,
        cta: {
          enabled: true,
          label: 'Go',
          url: 'https://x.com/a',
          color: '#ffff00',
          background: '#ffffff',
        },
      },
    } as never);
    const { html } = serializeWithPlaceholders(c);
    expect(html).not.toContain('color:#ffff00;text-decoration:none;display:inline-block');
  });

  it('renders a coloured card background with padding and bgcolor', () => {
    const base = sampleFor('aurora');
    const c = createConfig({
      ...base,
      theme: { ...base.theme, background: { color: '#fef3c7' } },
    } as never);
    const { html } = serializeWithPlaceholders(c);
    expect(html).toContain('bgcolor="#fef3c7"');
    expect(html).toMatch(/padding:12px/);
  });

  it('dark variant uses light text colours', () => {
    const base = sampleFor('aurora');
    const c = createConfig({
      ...base,
      theme: { ...base.theme, darkMode: 'force-dark-variant' },
    } as never);
    expect(serializeWithPlaceholders(c).html).toMatch(/color:#f4f4f5/);
  });

  it('renders text links instead of icons', () => {
    const base = sampleFor('aurora');
    const c = createConfig({ ...base, socials: { ...base.socials, textLinks: true } } as never);
    const { html } = serializeWithPlaceholders(c);
    expect(html).toContain('>LinkedIn</a>');
    expect(html).not.toMatch(/icon0+/);
  });
});

describe('preview mode', () => {
  it('rejects blob: image URLs unless preview is allowed', () => {
    const cfg = sampleFor('aurora');
    const assets = placeholderAssets(cfg);
    assets.slots.avatar!.url = 'blob:http://localhost:3000/abc';
    expect(serializeSignature(cfg, assets).html).not.toContain('blob:');
    expect(serializeSignature(cfg, assets, { allowLocalPreview: true }).html).toContain('blob:');
    expect(serializeSignature(cfg, assets, { allowLocalPreview: true }).issues).toEqual([]);
  });
});

describe('lintHtml', () => {
  it.each([
    ['script tag', '<table><tr><td><script>alert(1)</script></td></tr></table>', 'forbidden-tag'],
    ['style block', '<style>a{}</style>', 'forbidden-tag'],
    [
      'event handler',
      '<table><tr><td><img src="https://a.b/x.png" width="10" height="10" alt="" onerror="x()" /></td></tr></table>',
      'event-handler',
    ],
    ['javascript url', '<a href="javascript:alert(1)">x</a>', 'js-url'],
    ['http link', '<a href="http://a.b">x</a>', 'href-scheme'],
    [
      'data uri',
      '<img src="data:image/gif;base64,AAAA" width="10" height="10" alt="" />',
      'src-scheme',
    ],
    [
      'tracking pixel',
      '<img src="https://a.b/p.gif" width="1" height="1" alt="" />',
      'tracking-pixel',
    ],
    ['svg', '<svg></svg>', 'forbidden-tag'],
    ['css url()', '<table style="background:url(https://a.b/x.png)"></table>', 'css-url'],
    ['unquoted attr', '<td width=10>x</td>', 'malformed-tag'],
    ['comment', '<!-- hi -->', 'comment'],
  ])('flags %s', (_name, html, rule) => {
    expect(lintHtml(html).map((i) => i.rule)).toContain(rule);
  });

  it('passes clean serializer output', () => {
    const c = createConfig({ details: SAMPLE_DETAILS });
    expect(serializeWithPlaceholders(c).issues).toEqual([]);
  });
});

describe('type safety helper', () => {
  it('config type is exported', () => {
    const c: SignatureConfig = createConfig({ details: { fullName: 'A' } });
    expect(c.details.fullName).toBe('A');
  });
});
