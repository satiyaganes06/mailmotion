import { describe, expect, it } from 'vitest';
import {
  DARK_BG,
  LIGHT_BG,
  accentWindow,
  accessibleAccent,
  checkColor,
  contrastRatio,
  ensureContrast,
  linkColor,
  mix,
  readableOn,
} from '../src';

describe('contrastRatio', () => {
  it('matches WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 1);
  });
  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBeCloseTo(
      contrastRatio('#fedcba', '#123456'),
      10,
    );
  });
});

describe('ensureContrast', () => {
  it('leaves passing colours alone', () => {
    expect(ensureContrast('#000000', LIGHT_BG)).toBe('#000000');
  });
  it('darkens a failing colour on a light background to >= 4.5', () => {
    const out = ensureContrast('#ec4899', LIGHT_BG);
    expect(contrastRatio(out, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
  });
  it('lightens a failing colour on a dark background', () => {
    const out = ensureContrast('#333333', DARK_BG, 4.5);
    expect(contrastRatio(out, DARK_BG)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('accessibleAccent', () => {
  it('has a non-empty luminance window', () => {
    const w = accentWindow();
    expect(w.min).toBeLessThan(w.max);
  });
  it.each([
    '#ec4899',
    '#06b6d4',
    '#f59e0b',
    '#7c3aed',
    '#b34700',
    '#ffffff',
    '#000000',
    '#6366f1',
    '#22c55e',
  ])('makes %s readable on light and dark', (hex) => {
    const out = accessibleAccent(hex);
    const c = checkColor(out);
    expect(c.light.ratio).toBeGreaterThanOrEqual(4.5 - 1e-3);
    expect(c.dark.ratio).toBeGreaterThanOrEqual(3 - 1e-3);
  });
  it('keeps an already-passing colour unchanged', () => {
    const ok = accessibleAccent('#b34700');
    expect(accessibleAccent(ok)).toBe(ok);
  });
  it('linkColor delegates to accessibleAccent', () => {
    expect(linkColor('#ec4899')).toBe(accessibleAccent('#ec4899'));
  });
});

describe('helpers', () => {
  it('readableOn picks black on white and white on black', () => {
    expect(readableOn('#ffffff')).toBe('#000000');
    expect(readableOn('#000000')).toBe('#ffffff');
  });
  it('mix interpolates', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});
