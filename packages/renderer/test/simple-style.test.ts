import { describe, expect, it } from 'vitest';
import { SIMPLE_PRESETS, createFromSimplePreset, SIMPLE_PRESET_LIST } from '@mailmotion/presets';
import { LIMITS, createConfig, type SignatureConfigInput } from '@mailmotion/schema';
import { lintHtml, serializeSignature } from '@mailmotion/serializer';
import { checkGifBudget, renderSignatureAssets, toSignatureAssets, uniqueFiles } from '../src';
import { env } from './helpers';

const DETAILS: SignatureConfigInput['details'] = {
  fullName: 'Aina Rahman',
  title: 'Product Designer',
  company: 'Lumen Labs',
  phones: [{ label: '', number: '+60 12 345 6789' }],
  email: 'aina@lumenlabs.io',
  websites: [{ url: 'https://lumenlabs.io' }],
  tagline: 'Designing calmer fintech apps',
};

function sample(id: (typeof SIMPLE_PRESET_LIST)[number]['id']) {
  return createConfig(createFromSimplePreset(id, DETAILS) as unknown as SignatureConfigInput);
}

describe('Simple Style: all ten designs render for real', () => {
  for (const preset of SIMPLE_PRESET_LIST) {
    it(`${preset.id}: renders, uploads-ready assets, lint-clean HTML within budget`, async () => {
      const cfg = sample(preset.id);
      const rendered = await renderSignatureAssets(cfg, env);
      expect(rendered.length).toBeGreaterThan(0);

      const files = uniqueFiles(rendered);
      const assets = toSignatureAssets(rendered, 'https://cdn.example.com/sig');
      const out = serializeSignature(cfg, assets);

      expect(lintHtml(out.html)).toEqual([]);
      expect(out.chars).toBeLessThanOrEqual(LIMITS.htmlChars);
      expect(out.html).toContain(cfg.details.fullName);

      for (const [, f] of files) {
        if (f.format === 'gif') {
          const problems = checkGifBudget(f.bytes).problems;
          expect(problems, `${preset.id} ${f.slotId}: ${problems.join('; ')}`).toEqual([]);
        }
      }
    }, 30_000);
  }

  it('typewriter, wave, shimmer and ticker designs have no avatar slot; the rest do', async () => {
    for (const preset of SIMPLE_PRESET_LIST) {
      const rendered = await renderSignatureAssets(sample(preset.id), env);
      const hasAvatar = rendered.some((r) => r.slotId === 'avatar');
      const expectAvatar = ![
        'simple-typewriter',
        'simple-wave',
        'simple-shimmer',
        'simple-ticker',
        'simple-ink',
      ].includes(preset.id);
      expect(hasAvatar, preset.id).toBe(expectAvatar);
    }
  }, 60_000);

  it('every design uses the pipe contact separator, not the middot', async () => {
    for (const preset of SIMPLE_PRESET_LIST) {
      const cfg = sample(preset.id);
      const rendered = await renderSignatureAssets(cfg, env);
      const assets = toSignatureAssets(rendered, 'https://cdn.example.com/sig');
      const out = serializeSignature(cfg, assets);
      expect(out.html, preset.id).not.toContain('&middot;');
    }
  }, 30_000);

  it("a design's HTML only ever shows the fields its panel exposes, even with a filled-in tagline that isn't shown", async () => {
    // Regression: Aurora doesn't show a tagline field, but the sample details carry a tagline
    // (for Typewriter/Equalizer's benefit) — it must not leak into Aurora's rendered output.
    for (const preset of SIMPLE_PRESET_LIST) {
      const cfg = sample(preset.id);
      const rendered = await renderSignatureAssets(cfg, env);
      const assets = toSignatureAssets(rendered, 'https://cdn.example.com/sig');
      const out = serializeSignature(cfg, assets);
      const { fields } = SIMPLE_PRESETS[preset.id];
      if (!fields.tagline && !fields.status) {
        expect(out.html, preset.id).not.toContain('Designing calmer fintech apps');
      }
      if (!fields.company) expect(out.html, preset.id).not.toContain('Lumen Labs');
      if (!fields.phone) expect(out.html, preset.id).not.toContain('tel:');
      if (!fields.email) expect(out.html, preset.id).not.toContain('mailto:');
      // (the email address also happens to end in "lumenlabs.io", so check for the site link
      // specifically rather than the bare substring)
      if (!fields.website) expect(out.html, preset.id).not.toContain('href="https://lumenlabs.io');
    }
  }, 30_000);
});
