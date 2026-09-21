import { describe, expect, it } from 'vitest';
import { createConfig } from '@mailmotion/schema';
import { LAYOUT_LIST, markSize, placeholderAssets, planAssets } from '../src';

const base = createConfig({ details: { fullName: 'Ada Lovelace' } });

describe('layout specs', () => {
  it('describes all six layouts', () => {
    expect(LAYOUT_LIST.map((l) => l.id).sort()).toEqual(
      ['banner', 'bordered', 'card', 'editorial', 'left-portrait', 'stacked'].sort(),
    );
  });
});

describe('planAssets', () => {
  it('plans an animated avatar and mark by default', () => {
    const slots = planAssets(base);
    const avatar = slots.find((s) => s.id === 'avatar')!;
    expect(avatar).toMatchObject({ width: 80, height: 80, format: 'gif', animated: true });
    expect(slots.find((s) => s.id === 'mark')?.format).toBe('gif');
  });
  it('uses PNG for static avatars and marks', () => {
    const c = createConfig({
      details: { fullName: 'A' },
      avatar: { animation: 'none' },
      mark: { animation: 'none' },
    });
    const slots = planAssets(c);
    expect(slots.find((s) => s.id === 'avatar')?.format).toBe('png');
    expect(slots.find((s) => s.id === 'mark')?.format).toBe('png');
  });
  it('plans one icon per social, none for text links', () => {
    const items = [
      { platform: 'github' as const, url: 'https://github.com/a' },
      { platform: 'linkedin' as const, url: 'https://linkedin.com/in/a' },
    ];
    const icons = planAssets(
      createConfig({ details: { fullName: 'A' }, socials: { items } }),
    ).filter((s) => s.kind === 'icon');
    expect(icons.map((i) => i.id)).toEqual(['icon:0', 'icon:1']);
    const none = planAssets(
      createConfig({ details: { fullName: 'A' }, socials: { items, textLinks: true } }),
    ).filter((s) => s.kind === 'icon');
    expect(none).toHaveLength(0);
  });
  it('drops sections hidden by the active variant', () => {
    const c = createConfig({
      details: { fullName: 'A' },
      extras: { banner: { enabled: true } },
      layout: { variant: 'reply' },
    });
    expect(planAssets(c).some((s) => s.kind === 'banner')).toBe(false);
    const full = createConfig({
      details: { fullName: 'A' },
      extras: { banner: { enabled: true } },
    });
    expect(planAssets(full).some((s) => s.kind === 'banner')).toBe(true);
  });
  it('keeps banner strips within 460px', () => {
    const c = createConfig({ details: { fullName: 'A' }, extras: { banner: { enabled: true } } });
    expect(planAssets(c).find((s) => s.kind === 'banner')!.width).toBeLessThanOrEqual(460);
  });
  it('sizes drawn marks from their aspect ratio', () => {
    const c = createConfig({
      details: { fullName: 'A' },
      mark: { mode: 'drawn', strokesAspect: 3 },
    });
    const { width, height } = markSize(c);
    expect(width / height).toBeCloseTo(3, 0);
  });
});

describe('placeholderAssets', () => {
  it('produces a URL for every planned slot with hashed-looking names', () => {
    const a = placeholderAssets(base, 'https://user.github.io/mailmotion-signatures/');
    for (const p of planAssets(base)) {
      expect(a.slots[p.id]!.url).toMatch(
        /^https:\/\/user\.github\.io\/mailmotion-signatures\/[a-z0-9]{64}\.(gif|png)$/,
      );
    }
  });
});
