import { describe, expect, it } from 'vitest';
import { LAYOUT_IDS, createConfig, type SignatureConfig } from '@mailmotion/schema';
import { placeholderAssets } from '@mailmotion/layouts';
import { lintHtml, serializeSignature } from '../src';
import { sampleFor } from './fixtures';

const HOSTILE = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "'><svg onload=alert(1)>",
  '</td></tr></table><script>steal()</script>',
  '&lt;b&gt; &amp; "quotes" \'single\'',
  'javascript:alert(1)',
  '‮rtl-override',
  '<style>*{display:none}</style>',
];

/** Build a config whose every text field is hostile (schema-valid: text fields accept any string). */
function hostileConfig(payload: string, layoutId: (typeof LAYOUT_IDS)[number]): SignatureConfig {
  const trim = (n: number) => payload.slice(0, n);
  const base = sampleFor('aurora');
  return createConfig({
    ...base,
    layout: { ...base.layout, id: layoutId },
    details: {
      ...base.details,
      fullName: trim(60),
      pronouns: trim(20),
      title: trim(80),
      department: trim(60),
      company: trim(80),
      tagline: trim(90),
      address: { text: trim(120) },
      phones: [{ label: trim(20), number: '+60123456789' }],
      customFields: [{ label: trim(30), value: trim(80) }],
    },
    extras: {
      ...base.extras,
      disclaimer: payload,
      greenNote: true,
      greenNoteText: trim(120),
      banner: { enabled: true, kind: 'wave', text: trim(60) },
      cta: { enabled: true, label: trim(30), url: 'https://example.com', color: '#ffffff' },
    },
    mark: { ...base.mark, customText: trim(30) },
  } as never);
}

describe('injection resistance', () => {
  for (const layoutId of LAYOUT_IDS) {
    for (const payload of HOSTILE) {
      it(`${layoutId}: ${JSON.stringify(payload).slice(0, 40)}`, () => {
        const cfg = hostileConfig(payload, layoutId);
        const { html, issues } = serializeSignature(cfg, placeholderAssets(cfg));
        expect(issues).toEqual([]);
        expect(lintHtml(html)).toEqual([]);
        // No raw angle brackets from user text survive: every `<` starts a tag we generated.
        expect(html).not.toMatch(/<script/i);
        expect(html).not.toMatch(/<svg/i);
        expect(html).not.toMatch(/<style/i);
        // Payload text such as `onerror=` is inert once escaped; `lintHtml` (above) parses every tag
        // and would flag any real event-handler attribute.
        expect(html).not.toMatch(/href="javascript/i);
      });
    }
  }

  it('drops non-https links even if they bypass the schema', () => {
    const cfg = sampleFor('aurora');
    const evil = structuredClone(cfg);
    evil.details.companyUrl = 'javascript:alert(1)';
    evil.details.websites = [
      { url: 'http://insecure.example' },
      { url: 'data:text/html,<script>' },
    ];
    evil.socials.items[0]!.url = 'javascript:alert(1)';
    evil.details.email = 'a"b@c.com';
    evil.details.phones = [{ label: '', number: 'javascript:1' }];
    const { html, issues } = serializeSignature(evil, placeholderAssets(evil));
    expect(issues).toEqual([]);
    // an unlinkable phone number may still show as inert text, but never as a link
    expect(html).not.toMatch(/(href|src)="\s*javascript:/i);
    expect(html).not.toMatch(/href="[^"]*insecure/);
    expect(html).not.toContain('data:text');
    expect(html).not.toContain('mailto:a"');
  });

  it('refuses http/data/js image sources', () => {
    const cfg = sampleFor('aurora');
    const assets = placeholderAssets(cfg);
    for (const bad of [
      'http://evil.example/x.gif',
      'javascript:alert(1)',
      'data:image/gif;base64,AAAA',
      'https://a b/x.gif',
    ]) {
      assets.slots.avatar!.url = bad;
      expect(serializeSignature(cfg, assets).html).not.toContain(bad);
    }
  });

  it('escapes quotes so attributes cannot be broken out of', () => {
    const cfg = sampleFor('aurora');
    cfg.details.fullName = '"><b>x</b>';
    const assets = placeholderAssets(cfg);
    const { html } = serializeSignature(cfg, assets);
    expect(html).not.toContain('"><b>');
    expect(html).toContain('&quot;&gt;&lt;b&gt;');
  });
});
