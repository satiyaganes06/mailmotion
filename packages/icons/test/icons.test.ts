import { describe, expect, it } from 'vitest';
import { PLATFORMS } from '@mailmotion/schema';
import { GLYPHS } from '../src';

describe('glyphs', () => {
  it('has artwork for every platform the schema allows', () => {
    for (const p of PLATFORMS) {
      const g = GLYPHS[p.id];
      expect(g, p.id).toBeDefined();
      expect(g.length, p.id).toBeGreaterThan(0);
      for (const part of g) {
        expect(part.d.length).toBeGreaterThan(5);
        expect(part.d).toMatch(/^M/i);
        expect(part.d).not.toMatch(/NaN|undefined/);
      }
    }
  });
  it('LinkedIn is drawn locally (Simple Icons dropped it)', () => {
    expect(GLYPHS.linkedin[0]!.mode).toBe('fill');
  });
});
