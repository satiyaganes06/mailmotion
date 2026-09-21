import { describe, expect, it } from 'vitest';
import { PRESET_IDS, createConfig } from '@mailmotion/schema';
import {
  PALETTE_LIST,
  PRESET_LIST,
  applyPalette,
  applyPreset,
  createFromPreset,
  remix,
} from '../src';

describe('presets', () => {
  it('ships exactly the six designs in the plan', () => {
    expect(PRESET_LIST.map((p) => p.id).sort()).toEqual([...PRESET_IDS].sort());
    expect(PRESET_LIST).toHaveLength(6);
  });
  it.each(PRESET_LIST.map((p) => p.id))('%s produces a valid config', (id) => {
    const c = createFromPreset(id, { fullName: 'Ada Lovelace', title: 'Engineer' });
    expect(c.presetId).toBe(id);
    expect(c.details.fullName).toBe('Ada Lovelace');
  });
  it('maps designs to the layouts and animations in the plan', () => {
    const d = { fullName: 'A' };
    expect(createFromPreset('aurora', d).layout.id).toBe('card');
    expect(createFromPreset('aurora', d).avatar.animation).toBe('aurora');
    expect(createFromPreset('portrait', d).layout.id).toBe('left-portrait');
    expect(createFromPreset('portrait', d).avatar.animation).toBe('strip-reveal');
    expect(createFromPreset('editorial', d).avatar.animation).toBe('pulse');
    expect(createFromPreset('wave', d).extras.banner.enabled).toBe(true);
    expect(createFromPreset('neon', d).mark.glow).toBe(true);
    expect(createFromPreset('equalizer', d).avatar.animation).toBe('equalizer');
    expect(createFromPreset('equalizer', d).extras.alignment).toBe('center');
  });
  it('switching preset keeps the user content', () => {
    const base = createConfig({
      details: { fullName: 'Grace Hopper', title: 'Rear Admiral' },
      socials: { items: [{ platform: 'github', url: 'https://github.com/grace' }] },
      avatar: { image: 'data:image/png;base64,iVBORw0KGgo=', source: 'photo' },
    });
    const next = applyPreset(base, 'neon');
    expect(next.details.title).toBe('Rear Admiral');
    expect(next.socials.items).toHaveLength(1);
    expect(next.avatar.image).toBe(base.avatar.image);
    expect(next.layout.id).toBe('bordered');
  });
});

describe('remix', () => {
  it('puts the Neon avatar on the Card layout', () => {
    const c = remix(createFromPreset('aurora', { fullName: 'A' }), {
      layout: 'card',
      avatarAnimation: 'neon',
    });
    expect(c.layout.id).toBe('card');
    expect(c.avatar.animation).toBe('neon');
    expect(c.presetId).toBeUndefined();
  });
  it('has 12 palettes and applies one', () => {
    expect(PALETTE_LIST.length).toBeGreaterThanOrEqual(12);
    const c = applyPalette(createConfig({ details: { fullName: 'A' } }), 'ocean');
    expect(c.theme.accent).toBe('#0369a1');
    expect(c.theme.palette).toBe('ocean');
  });
});
