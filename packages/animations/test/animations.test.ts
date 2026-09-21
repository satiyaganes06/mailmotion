import { describe, expect, it } from 'vitest';
import { AVATAR_ANIMATIONS as IDS, LIMITS } from '@mailmotion/schema';
import {
  AVATAR_ANIMATION_DEFS,
  FRAME_DELAY_MS,
  avatarTimeline,
  bannerTimeline,
  logoTimeline,
  outline,
  smoothstep,
  window01,
} from '../src';

describe('timelines respect the fps cap', () => {
  it('every delay is >= 90ms (<= 11.1 fps) for every speed', () => {
    for (const d of Object.values(FRAME_DELAY_MS)) expect(1000 / d).toBeLessThanOrEqual(LIMITS.fps);
  });
  it.each(IDS)('%s: frames match its definition and start at t = 0', (id) => {
    const tl = avatarTimeline(id, 'normal');
    expect(tl).toHaveLength(Math.max(1, AVATAR_ANIMATION_DEFS[id].frames));
    expect(tl[0]!.t).toBe(0);
    for (const f of tl.length > 1 ? tl : []) expect(f.delayMs).toBeGreaterThanOrEqual(90);
    for (const f of tl) expect(f.t).toBeLessThan(1);
  });
  it('none is a single static frame', () => expect(avatarTimeline('none', 'fast')).toHaveLength(1));
  it('banner and logo timelines are capped too', () => {
    for (const k of ['wave', 'ticker', 'shimmer'] as const)
      for (const f of bannerTimeline(k, 'fast')) expect(f.delayMs).toBeGreaterThanOrEqual(90);
    for (const f of logoTimeline('fast')) expect(f.delayMs).toBeGreaterThanOrEqual(90);
    expect(bannerTimeline('static', 'normal')).toHaveLength(1);
  });
});

describe('outline', () => {
  it.each(['circle', 'rounded', 'square', 'squircle'] as const)(
    '%s has a closed path and a sane perimeter',
    (shape) => {
      const o = outline(shape, 0, 0, 100, 100);
      expect(o.d.startsWith('M')).toBe(true);
      expect(o.d.endsWith('Z')).toBe(true);
      expect(o.length).toBeGreaterThan(280);
      expect(o.length).toBeLessThan(420);
      expect(o.d).not.toMatch(/NaN/);
    },
  );
  it('circle perimeter is 2*pi*r', () =>
    expect(outline('circle', 0, 0, 100, 100).length).toBeCloseTo(Math.PI * 100, 5));
});

describe('easing helpers', () => {
  it('window01 and smoothstep clamp', () => {
    expect(window01(0.2, 0.4, 0.1)).toBe(0);
    expect(window01(0.2, 0.4, 0.5)).toBe(1);
    expect(window01(0.2, 0.4, 0.3)).toBeCloseTo(0.5, 5);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 5);
  });
});
